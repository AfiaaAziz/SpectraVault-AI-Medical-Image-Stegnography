"""Blind block-DFT (2D FFT) steganography with uint8-safe parity embedding."""

from __future__ import annotations

import cv2
import numpy as np


class FFTStego:
    """
    Block-wise 2D DFT (``np.fft.fft2``) steganography for real X-ray images.

    Each 8x8 block stores:
    - 4 LSBs of pixel (0,0): which frequency coefficient carried the bit
    - parity of that coefficient's magnitude: the payload bit

    Blind extraction reads the coefficient index from spatial LSBs, then the bit
    from the frequency domain — standard hybrid spatial/frequency DIP approach.
    """

    COEFFICIENTS = (
        (4, 4),
        (1, 1),
        (2, 3),
        (3, 1),
        (0, 1),
        (4, 2),
        (2, 4),
        (1, 4),
        (3, 3),
        (2, 2),
    )
    META_MASK = 0x0F

    def __init__(self, block_size: int = 8, coefficient: tuple[int, int] = (4, 4), strength: float = 8.0):
        self.bs = block_size
        self.ci, self.cj = coefficient
        self.q = strength

    def _text_to_bits(self, text: str) -> str:
        msg = "".join(format(ord(c), "08b") for c in text)
        return format(len(msg), "032b") + msg

    def _bits_to_text(self, bits_str: str) -> str:
        if len(bits_str) < 32:
            return ""
        n = int(bits_str[:32], 2)
        payload = bits_str[32 : 32 + n]
        if len(payload) < n:
            return ""
        return "".join(chr(int(payload[i : i + 8], 2)) for i in range(0, len(payload), 8))

    def _to_gray(self, arr: np.ndarray) -> np.ndarray:
        if arr.ndim == 3:
            return cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY).astype(np.float64)
        return arr.astype(np.float64)

    def _pad(self, gray: np.ndarray) -> tuple[np.ndarray, int, int]:
        h, w = gray.shape
        ph = (-h) % self.bs
        pw = (-w) % self.bs
        padded = np.pad(gray, ((0, ph), (0, pw)), mode="edge")
        return padded, h, w

    def capacity_bits(self, image_array: np.ndarray) -> int:
        gray = self._to_gray(image_array)
        padded, _, _ = self._pad(gray)
        return (padded.shape[0] // self.bs) * (padded.shape[1] // self.bs)

    def _coefficients_for_block(self, block_row: int, block_col: int) -> list[tuple[int, int]]:
        start = (block_row * 997 + block_col * 991) % len(self.COEFFICIENTS)
        return [self.COEFFICIENTS[(start + k) % len(self.COEFFICIENTS)] for k in range(len(self.COEFFICIENTS))]

    def _parity_bit_at(self, block: np.ndarray, ci: int, cj: int) -> str:
        spectrum = np.fft.fft2(block)
        coef = spectrum[ci, cj]
        q = int(round(abs(coef) / self.q))
        return "1" if q % 2 != 0 else "0"

    def _write_meta(self, block: np.ndarray, coeff_index: int) -> np.ndarray:
        out = block.copy()
        pixel = int(out[self.bs - 1, self.bs - 1])
        out[self.bs - 1, self.bs - 1] = (pixel & ~self.META_MASK) | (coeff_index & self.META_MASK)
        return out

    def _read_meta(self, block: np.ndarray) -> int:
        return int(block[self.bs - 1, self.bs - 1]) & self.META_MASK

    def _embed_bit_at(self, block: np.ndarray, bit: str, ci: int, cj: int, coeff_index: int) -> np.ndarray:
        spectrum = np.fft.fft2(block)
        coef = spectrum[ci, cj]
        phase = np.angle(coef)
        start_q = int(round(abs(coef) / self.q))
        if bit == "1" and start_q % 2 == 0:
            start_q += 1
        elif bit == "0" and start_q % 2 != 0:
            start_q += 1

        for delta in range(0, 256):
            candidates = [start_q + delta]
            if delta > 0:
                candidates.append(start_q - delta)
            for q in candidates:
                if q < 0:
                    continue
                spectrum[ci, cj] = q * self.q * np.exp(1j * phase)
                spatial = np.real(np.fft.ifft2(spectrum))
                quant = np.clip(spatial, 0, 255).astype(np.uint8).astype(np.float64)
                tagged = self._write_meta(quant, coeff_index)
                if self._read_meta(tagged) != coeff_index:
                    continue
                if self._parity_bit_at(tagged, ci, cj) == bit:
                    return tagged
        raise ValueError(f"Could not embed bit {bit} at coefficient ({ci}, {cj})")

    def _embed_bit_in_block(self, block: np.ndarray, bit: str, block_row: int, block_col: int) -> np.ndarray:
        coeffs_order = self._coefficients_for_block(block_row, block_col)
        for coeff_index, (ci, cj) in enumerate(coeffs_order):
            try:
                return self._embed_bit_at(block, bit, ci, cj, coeff_index)
            except ValueError:
                continue
        raise ValueError(f"Could not embed bit {bit} in block ({block_row}, {block_col})")

    def embed(self, image_array: np.ndarray, message: str) -> np.ndarray:
        gray = self._to_gray(image_array)
        padded, h, w = self._pad(gray)
        full_bits = self._text_to_bits(message)
        capacity = self.capacity_bits(image_array)
        if len(full_bits) > capacity:
            raise ValueError(f"Message too large: {len(full_bits)} bits > {capacity} capacity")

        stego = padded.copy()
        bit_idx = 0

        for bi, i in enumerate(range(0, padded.shape[0], self.bs)):
            for bj, j in enumerate(range(0, padded.shape[1], self.bs)):
                if bit_idx >= len(full_bits):
                    break
                block = stego[i : i + self.bs, j : j + self.bs]
                stego[i : i + self.bs, j : j + self.bs] = self._embed_bit_in_block(
                    block, full_bits[bit_idx], bi, bj
                )
                bit_idx += 1

        clipped = np.clip(stego[:h, :w], 0, 255).astype(np.uint8)
        if image_array.ndim == 3:
            return np.stack([clipped] * 3, axis=-1)
        return clipped

    def extract(self, stego_array: np.ndarray) -> str:
        gray = self._to_gray(stego_array)
        padded, _, _ = self._pad(gray)
        capacity = (padded.shape[0] // self.bs) * (padded.shape[1] // self.bs)

        all_bits: list[str] = []
        msg_len: int | None = None

        for bi, i in enumerate(range(0, padded.shape[0], self.bs)):
            for bj, j in enumerate(range(0, padded.shape[1], self.bs)):
                block = padded[i : i + self.bs, j : j + self.bs]
                coeff_index = self._read_meta(block)
                coeffs = self._coefficients_for_block(bi, bj)
                if coeff_index >= len(coeffs):
                    return ""
                ci, cj = coeffs[coeff_index]
                all_bits.append(self._parity_bit_at(block, ci, cj))

                if msg_len is None and len(all_bits) >= 32:
                    msg_len = int("".join(all_bits[:32]), 2)
                    if msg_len <= 0 or 32 + msg_len > capacity:
                        return ""

                if msg_len is not None and len(all_bits) >= 32 + msg_len:
                    return self._bits_to_text("".join(all_bits))

        return self._bits_to_text("".join(all_bits))

    def round_trip_ok(self, image_array: np.ndarray, message: str) -> bool:
        stego = self.embed(image_array.copy(), message)
        return self.extract(stego) == message
