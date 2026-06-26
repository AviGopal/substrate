import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import io
import unittest

from grep import grep
from unittest import mock

FILE_TEXT = {
    "alpha.txt": (
        "Sierra climbers reached the mountain peak.\n"
        "Whiskey barrels aged in oak cellars here.\n"
        "Sierra winds swept down the valley floor.\n"
        "Tango dancers moved across the ballroom stage.\n"
        "Sierra eagles soared above the canyon rim.\n"
        "Uniform standards kept the group aligned well.\n"
        "Sierra roads wound through the forest path.\n"
        "Victor teams celebrated their tournament win.\n"
    ),
    "beta.txt": (
        "Quebec city hosted the winter festival now.\n"
        "Lima beans grow in tropical climates here.\n"
        "Quebec province extends to the north shore.\n"
        "Mike stations broadcast on all frequencies.\n"
        "Quebec winters bring heavy snowfall often.\n"
        "November rain fell gently on the rooftop.\n"
    ),
    "gamma.txt": (
        "Foxtrot patterns require strict discipline.\n"
        "Charlie teams worked through the full night.\n"
        "Foxtrot routines need rehearsal every week.\n"
        "Delta planes landed at the coastal airport.\n"
        "Foxtrot dancers practiced their turns today.\n"
        "Echo chambers amplified every small sound.\n"
        "Foxtrot contests attract skilled performers.\n"
        "Hotel rooms filled for the big convention.\n"
    ),
}


def open_mock(fname, *args, **kwargs):
    try:
        return io.StringIO(FILE_TEXT[fname])
    except KeyError:
        raise RuntimeError(
            "Expected one of {0!r}: got {1!r}".format(list(FILE_TEXT.keys()), fname)
        )


@mock.patch("grep.open", name="open", side_effect=open_mock, create=True)
@mock.patch("io.StringIO", name="StringIO", wraps=io.StringIO)
class GrepTest(unittest.TestCase):
    # Single file tests
    def test_one_file_one_match_no_flags(self, mock_file, mock_open):
        self.assertMultiLineEqual(
            grep("Lima", "", ["beta.txt"]),
            "Lima beans grow in tropical climates here.\n",
        )

    def test_one_file_one_match_print_line_numbers_flag(self, mock_file, mock_open):
        self.assertMultiLineEqual(
            grep("Lima", "-n", ["beta.txt"]),
            "2:Lima beans grow in tropical climates here.\n",
        )

    def test_one_file_one_match_case_insensitive_flag(self, mock_file, mock_open):
        self.assertMultiLineEqual(
            grep("LIMA", "-i", ["beta.txt"]),
            "Lima beans grow in tropical climates here.\n",
        )

    def test_one_file_one_match_print_file_names_flag(self, mock_file, mock_open):
        self.assertMultiLineEqual(
            grep("Lima", "-l", ["beta.txt"]), "beta.txt\n"
        )

    def test_one_file_one_match_match_entire_lines_flag(self, mock_file, mock_open):
        self.assertMultiLineEqual(
            grep("Lima beans grow in tropical climates here.", "-x", ["beta.txt"]),
            "Lima beans grow in tropical climates here.\n",
        )

    def test_one_file_one_match_multiple_flags(self, mock_file, mock_open):
        self.assertMultiLineEqual(
            grep("LIMA BEANS GROW IN TROPICAL CLIMATES HERE.", "-n -i -x", ["beta.txt"]),
            "2:Lima beans grow in tropical climates here.\n",
        )

    def test_one_file_several_matches_no_flags(self, mock_file, mock_open):
        self.assertMultiLineEqual(
            grep("Quebec", "", ["beta.txt"]),
            "Quebec city hosted the winter festival now.\n"
            "Quebec province extends to the north shore.\n"
            "Quebec winters bring heavy snowfall often.\n",
        )

    def test_one_file_several_matches_print_line_numbers_flag(
        self, mock_file, mock_open
    ):
        self.assertMultiLineEqual(
            grep("Quebec", "-n", ["beta.txt"]),
            "1:Quebec city hosted the winter festival now.\n"
            "3:Quebec province extends to the north shore.\n"
            "5:Quebec winters bring heavy snowfall often.\n",
        )

    def test_one_file_several_matches_match_entire_lines_flag(
        self, mock_file, mock_open
    ):
        self.assertMultiLineEqual(
            grep("Quebec", "-x", ["beta.txt"]), ""
        )

    def test_one_file_several_matches_case_insensitive_flag(
        self, mock_file, mock_open
    ):
        self.assertMultiLineEqual(
            grep("QUEBEC", "-i", ["beta.txt"]),
            "Quebec city hosted the winter festival now.\n"
            "Quebec province extends to the north shore.\n"
            "Quebec winters bring heavy snowfall often.\n",
        )

    def test_one_file_several_matches_inverted_flag(self, mock_file, mock_open):
        self.assertMultiLineEqual(
            grep("Foxtrot", "-v", ["gamma.txt"]),
            "Charlie teams worked through the full night.\n"
            "Delta planes landed at the coastal airport.\n"
            "Echo chambers amplified every small sound.\n"
            "Hotel rooms filled for the big convention.\n",
        )

    def test_one_file_no_matches_various_flags(self, mock_file, mock_open):
        self.assertMultiLineEqual(
            grep("Mongoose", "-n -l -x -i", ["alpha.txt"]), ""
        )

    def test_one_file_one_match_file_names_flag_only(self, mock_file, mock_open):
        self.assertMultiLineEqual(
            grep("Whiskey", "-l", ["alpha.txt"]), "alpha.txt\n"
        )

    # Multiple file tests
    def test_multiple_files_one_match_no_flags(self, mock_file, mock_open):
        self.assertMultiLineEqual(
            grep("Lima", "", ["alpha.txt", "beta.txt"]),
            "beta.txt:Lima beans grow in tropical climates here.\n",
        )

    def test_multiple_files_several_matches_no_flags(self, mock_file, mock_open):
        self.assertMultiLineEqual(
            grep("Sierra", "", ["alpha.txt", "beta.txt"]),
            "alpha.txt:Sierra climbers reached the mountain peak.\n"
            "alpha.txt:Sierra winds swept down the valley floor.\n"
            "alpha.txt:Sierra eagles soared above the canyon rim.\n"
            "alpha.txt:Sierra roads wound through the forest path.\n",
        )

    def test_multiple_files_several_matches_print_line_numbers_flag(
        self, mock_file, mock_open
    ):
        self.assertMultiLineEqual(
            grep("Sierra", "-n", ["alpha.txt", "beta.txt"]),
            "alpha.txt:1:Sierra climbers reached the mountain peak.\n"
            "alpha.txt:3:Sierra winds swept down the valley floor.\n"
            "alpha.txt:5:Sierra eagles soared above the canyon rim.\n"
            "alpha.txt:7:Sierra roads wound through the forest path.\n",
        )

    def test_multiple_files_several_matches_print_file_names_flag(
        self, mock_file, mock_open
    ):
        self.assertMultiLineEqual(
            grep("Sierra", "-l", ["alpha.txt", "beta.txt"]),
            "alpha.txt\n",
        )

    def test_multiple_files_several_matches_case_insensitive_flag(
        self, mock_file, mock_open
    ):
        self.assertMultiLineEqual(
            grep("SIERRA", "-i", ["alpha.txt", "beta.txt"]),
            "alpha.txt:Sierra climbers reached the mountain peak.\n"
            "alpha.txt:Sierra winds swept down the valley floor.\n"
            "alpha.txt:Sierra eagles soared above the canyon rim.\n"
            "alpha.txt:Sierra roads wound through the forest path.\n",
        )

    def test_multiple_files_several_matches_inverted_flag(self, mock_file, mock_open):
        self.assertMultiLineEqual(
            grep("Foxtrot", "-v", ["beta.txt", "gamma.txt"]),
            "beta.txt:Quebec city hosted the winter festival now.\n"
            "beta.txt:Lima beans grow in tropical climates here.\n"
            "beta.txt:Quebec province extends to the north shore.\n"
            "beta.txt:Mike stations broadcast on all frequencies.\n"
            "beta.txt:Quebec winters bring heavy snowfall often.\n"
            "beta.txt:November rain fell gently on the rooftop.\n"
            "gamma.txt:Charlie teams worked through the full night.\n"
            "gamma.txt:Delta planes landed at the coastal airport.\n"
            "gamma.txt:Echo chambers amplified every small sound.\n"
            "gamma.txt:Hotel rooms filled for the big convention.\n",
        )

    def test_multiple_files_one_match_print_file_names_flag(
        self, mock_file, mock_open
    ):
        self.assertMultiLineEqual(
            grep(
                "Lima",
                "-l",
                ["alpha.txt", "beta.txt", "gamma.txt"],
            ),
            "beta.txt\n",
        )

    def test_multiple_files_several_matches_multiple_flags(
        self, mock_file, mock_open
    ):
        self.assertMultiLineEqual(
            grep(
                "SIERRA CLIMBERS REACHED THE MOUNTAIN PEAK.",
                "-n -i -x",
                ["alpha.txt", "beta.txt", "gamma.txt"],
            ),
            "alpha.txt:1:Sierra climbers reached the mountain peak.\n",
        )

    def test_multiple_files_no_matches_various_flags(self, mock_file, mock_open):
        self.assertMultiLineEqual(
            grep(
                "Mongoose",
                "-n -l -x -i",
                ["alpha.txt", "beta.txt", "gamma.txt"],
            ),
            "",
        )

    def test_multiple_files_file_flag_takes_precedence_over_line_flag(
        self, mock_file, mock_open
    ):
        self.assertMultiLineEqual(
            grep(
                "Sierra",
                "-n -l",
                ["alpha.txt", "beta.txt", "gamma.txt"],
            ),
            "alpha.txt\n",
        )

    def test_multiple_files_inverted_and_match_entire_lines_flags(
        self, mock_file, mock_open
    ):
        self.assertMultiLineEqual(
            grep(
                "Sierra climbers reached the mountain peak.",
                "-x -v",
                ["alpha.txt", "beta.txt", "gamma.txt"],
            ),
            "alpha.txt:Whiskey barrels aged in oak cellars here.\n"
            "alpha.txt:Sierra winds swept down the valley floor.\n"
            "alpha.txt:Tango dancers moved across the ballroom stage.\n"
            "alpha.txt:Sierra eagles soared above the canyon rim.\n"
            "alpha.txt:Uniform standards kept the group aligned well.\n"
            "alpha.txt:Sierra roads wound through the forest path.\n"
            "alpha.txt:Victor teams celebrated their tournament win.\n"
            "beta.txt:Quebec city hosted the winter festival now.\n"
            "beta.txt:Lima beans grow in tropical climates here.\n"
            "beta.txt:Quebec province extends to the north shore.\n"
            "beta.txt:Mike stations broadcast on all frequencies.\n"
            "beta.txt:Quebec winters bring heavy snowfall often.\n"
            "beta.txt:November rain fell gently on the rooftop.\n"
            "gamma.txt:Foxtrot patterns require strict discipline.\n"
            "gamma.txt:Charlie teams worked through the full night.\n"
            "gamma.txt:Foxtrot routines need rehearsal every week.\n"
            "gamma.txt:Delta planes landed at the coastal airport.\n"
            "gamma.txt:Foxtrot dancers practiced their turns today.\n"
            "gamma.txt:Echo chambers amplified every small sound.\n"
            "gamma.txt:Foxtrot contests attract skilled performers.\n"
            "gamma.txt:Hotel rooms filled for the big convention.\n",
        )


if __name__ == "__main__":
    unittest.main()
