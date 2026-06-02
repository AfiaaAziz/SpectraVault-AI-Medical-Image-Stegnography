"""Blind DCT steganography via mid-frequency coefficient parity (JPEG-domain style)."""

from __future__ import annotations

import cv2
import numpy as np
from scipy.fftpack import dct, idct


class DCTStego:
    """
    Block-DCT steganography with blind extraction.
    Header: 32-bit payload-length prefix (same format as LSBStego).
    """

    def __init__(self, block_size: int = 8, coefficient: tuple[int, int] = (4, 3), alpha: float = 8.0):
        self.bs = block_size
        self.ci, self.cj = coefficient
        self.alpha = alpha

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
            return cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY).astype(np.float32)
        return arr.astype(np.float32)

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

    def _quantize_parity(self, coef: float, bit: str) -> float:
        q = int(round(coef / self.alpha))
        if bit == "1" and q % 2 == 0:
            q += 1
        elif bit == "0" and q % 2 != 0:
            q += 1
        return q * self.alpha

    def _parity_bit(self, coef: float) -> str:
        q = int(round(coef / self.alpha))
        return "1" if q % 2 != 0 else "0"

    def _embed_bit_in_block(self, block: np.ndarray, bit: str) -> np.ndarray:
        """Embed one bit and verify it survives uint8 quantisation (PNG-safe)."""
        dct_b = dct(dct(block.T, norm="ortho").T, norm="ortho")
        coef = dct_b[self.ci, self.cj]
        start_q = int(round(coef / self.alpha))
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
                trial = dct(dct(block.T, norm="ortho").T, norm="ortho")
                trial[self.ci, self.cj] = q * self.alpha
                spatial = idct(idct(trial.T, norm="ortho").T, norm="ortho")
                quant = np.clip(spatial, 0, 255).astype(np.uint8).astype(np.float32)
                check = dct(dct(quant.T, norm="ortho").T, norm="ortho")
                if self._parity_bit(check[self.ci, self.cj]) == bit:
                    return quant
        raise ValueError(f"Could not embed bit {bit} in DCT block (uint8 unstable)")

    def embed(self, image_array: np.ndarray, message: str) -> np.ndarray:
        gray = self._to_gray(image_array)
        padded, h, w = self._pad(gray)
        full_bits = self._text_to_bits(message)
        capacity = self.capacity_bits(image_array)
        if len(full_bits) > capacity:
            raise ValueError(f"Message too large: {len(full_bits)} bits > {capacity} capacity")

        stego = padded.copy()
        bit_idx = 0

        for i in range(0, padded.shape[0], self.bs):
            for j in range(0, padded.shape[1], self.bs):
                if bit_idx >= len(full_bits):
                    break
                block = stego[i : i + self.bs, j : j + self.bs]
                stego[i : i + self.bs, j : j + self.bs] = self._embed_bit_in_block(
                    block, full_bits[bit_idx]
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

        for i in range(0, padded.shape[0], self.bs):
            for j in range(0, padded.shape[1], self.bs):
                block = padded[i : i + self.bs, j : j + self.bs]
                dct_b = dct(dct(block.T, norm="ortho").T, norm="ortho")
                all_bits.append(self._parity_bit(dct_b[self.ci, self.cj]))

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
