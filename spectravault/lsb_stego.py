"""LSB spatial-domain steganography."""

import numpy as np


class LSBStego:
    """
    Least-Significant-Bit spatial-domain steganography.
    Blind extraction — only the stego image is needed.
    Header: 32-bit message-length prefix.
    """

    def __init__(self, bits: int = 1):
        self.bits = bits
        self.mask = (1 << bits) - 1
        self.clear = 0xFF ^ self.mask

    def _text_to_bits(self, text: str) -> str:
        msg = "".join(format(ord(c), "08b") for c in text)
        return format(len(msg), "032b") + msg

    def _bits_to_text(self, bits_str: str) -> str:
        n = int(bits_str[:32], 2)
        payload = bits_str[32 : 32 + n]
        return "".join(chr(int(payload[i : i + 8], 2)) for i in range(0, len(payload), 8))

    def capacity_bits(self, image_array: np.ndarray) -> int:
        return int(image_array.size)

    def embed(self, image_array: np.ndarray, message: str) -> np.ndarray:
        img = image_array.copy().astype(np.uint8)
        flat = img.flatten()
        full = self._text_to_bits(message)
        if len(full) > len(flat):
            raise ValueError(f"Message too large: {len(full)} bits > {len(flat)} capacity")
        for i, bit in enumerate(full):
            flat[i] = (flat[i] & self.clear) | int(bit)
        return flat.reshape(img.shape)

    def extract(self, stego_array: np.ndarray) -> str:
        flat = stego_array.flatten().astype(np.uint8)
        bits = "".join(str(p & self.mask) for p in flat)
        return self._bits_to_text(bits)

    def round_trip_ok(self, image_array: np.ndarray, message: str) -> bool:
        stego = self.embed(image_array.copy(), message)
        return self.extract(stego) == message
