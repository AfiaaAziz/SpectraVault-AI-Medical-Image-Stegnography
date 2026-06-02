"""Default pipeline configuration."""

DEFAULT_CONFIG = {
    "image_size": 224,
    "freq_image_size": 512,
    "lsb_bits": 1,
    "dct_block_size": 8,
    "dct_coefficient": (4, 3),
    "dct_alpha": 8.0,
    "fft_block_size": 8,
    "fft_coefficient": (4, 4),
    "fft_strength": 8.0,
    "ai_threshold": 0.30,
    "eval_n_images": 20,
}
