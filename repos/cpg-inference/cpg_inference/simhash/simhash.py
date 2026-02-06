"""SimHash generation and distance calculation."""

import hashlib
from typing import Sequence


class SimHashGenerator:
    """Generate SimHash fingerprints for feature sets.

    SimHash is a locality-sensitive hash where similar inputs
    produce hashes with small Hamming distances.

    Based on Charikar's algorithm:
    1. Hash each feature to get hash values
    2. For each bit position, accumulate +1 or -1 based on feature hashes
    3. Final hash: bit is 1 if accumulator > 0, else 0
    """

    def __init__(self, bits: int = 64):
        """Initialize SimHash generator.

        Args:
            bits: Number of bits in hash (64, 128, or 256)
        """
        if bits not in (64, 128, 256):
            raise ValueError("bits must be 64, 128, or 256")
        self.bits = bits

    def compute(self, features: Sequence[str]) -> int:
        """Compute SimHash for a set of features.

        Args:
            features: Sequence of feature strings

        Returns:
            SimHash as integer

        Example:
            >>> gen = SimHashGenerator(bits=64)
            >>> features = ["def", "function", "return"]
            >>> hash_value = gen.compute(features)
        """
        if not features:
            return 0

        # Initialize accumulator for each bit position
        accumulator = [0] * self.bits

        # Process each feature
        for feature in features:
            # Hash the feature
            feature_hash = self._hash_feature(feature)

            # Update accumulator based on each bit
            for i in range(self.bits):
                bit = (feature_hash >> i) & 1
                accumulator[i] += 1 if bit else -1

        # Generate final hash
        simhash = 0
        for i in range(self.bits):
            if accumulator[i] > 0:
                simhash |= 1 << i

        return simhash

    def _hash_feature(self, feature: str) -> int:
        """Hash a single feature to an integer.

        Args:
            feature: Feature string

        Returns:
            Hash value as integer
        """
        # Use MD5 for consistent hashing
        hash_bytes = hashlib.md5(feature.encode("utf-8")).digest()

        # Convert to integer (take first N bits)
        bytes_needed = self.bits // 8
        hash_int = int.from_bytes(hash_bytes[:bytes_needed], byteorder="big")

        return hash_int

    def hamming_distance(self, hash1: int, hash2: int) -> int:
        """Calculate Hamming distance between two hashes.

        Args:
            hash1: First hash
            hash2: Second hash

        Returns:
            Number of differing bits

        Example:
            >>> gen = SimHashGenerator()
            >>> dist = gen.hamming_distance(0b1010, 0b1100)
            >>> print(dist)  # 2
        """
        # XOR gives 1 where bits differ
        xor = hash1 ^ hash2

        # Count number of 1 bits
        return bin(xor).count("1")

    def similarity(self, hash1: int, hash2: int) -> float:
        """Calculate similarity score (0.0 to 1.0).

        Args:
            hash1: First hash
            hash2: Second hash

        Returns:
            Similarity score (1.0 = identical, 0.0 = maximum distance)
        """
        distance = self.hamming_distance(hash1, hash2)
        return 1.0 - (distance / self.bits)

    def hash_to_hex(self, hash_value: int) -> str:
        """Convert hash to hexadecimal string.

        Args:
            hash_value: Hash as integer

        Returns:
            Hex string (0-padded to bit width)
        """
        hex_chars = self.bits // 4
        return f"{hash_value:0{hex_chars}x}"

    def hex_to_hash(self, hex_string: str) -> int:
        """Convert hexadecimal string to hash.

        Args:
            hex_string: Hex string

        Returns:
            Hash as integer
        """
        return int(hex_string, 16)

