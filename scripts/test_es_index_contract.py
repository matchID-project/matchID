import tempfile
import unittest
from pathlib import Path

from scripts.es_index_contract import (
    compare_contract_dirs,
    infer_source_types,
    select_sample,
    write_contract,
)


class SelectSampleTest(unittest.TestCase):
    def test_sample_is_deterministic_and_scan_order_independent(self):
        docs = [
            {"_id": "3", "_source": {"name": "c"}},
            {"_id": "1", "_source": {"name": "a"}},
            {"_id": "2", "_source": {"name": "b"}},
            {"_id": "4", "_source": {"name": "d"}},
        ]

        self.assertEqual(
            select_sample(docs, sample_size=2, seed=424242),
            select_sample(list(reversed(docs)), sample_size=2, seed=424242),
        )


class SourceTypesTest(unittest.TestCase):
    def test_infer_source_types_records_nested_and_array_types(self):
        types = infer_source_types(
            {
                "name": "Ada",
                "score": 12,
                "aliases": ["a", "b"],
                "flags": [True, None],
                "meta": {"ratio": 1.5},
            }
        )

        self.assertEqual(types["name"], ["str"])
        self.assertEqual(types["score"], ["int"])
        self.assertEqual(types["aliases"], ["array"])
        self.assertEqual(types["aliases[]"], ["str"])
        self.assertEqual(types["flags[]"], ["bool", "null"])
        self.assertEqual(types["meta"], ["object"])
        self.assertEqual(types["meta.ratio"], ["float"])


class CompareContractsTest(unittest.TestCase):
    def test_compare_contract_dirs_detects_count_mapping_types_and_sample(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            left = root / "left"
            right = root / "right"
            write_contract(
                left,
                count=1,
                mapping={"properties": {"name": {"type": "keyword"}}},
                source_types={"name": ["str"]},
                sample=[{"_id": "1", "_source": {"name": "Ada"}}],
                metadata={"dataset": "left"},
            )
            write_contract(
                right,
                count=2,
                mapping={"properties": {"name": {"type": "text"}}},
                source_types={"name": ["str", "null"]},
                sample=[{"_id": "1", "_source": {"name": None}}],
                metadata={"dataset": "right"},
            )

            result = compare_contract_dirs(left, right)

        self.assertFalse(result.ok)
        self.assertEqual(
            sorted(result.mismatches),
            ["count", "mapping", "sample", "source-types"],
        )


if __name__ == "__main__":
    unittest.main()
