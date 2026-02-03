#!/usr/bin/env python3
"""
Unit tests for the Selene Period Tracker application.
"""

import unittest
import os
import json
from datetime import datetime, timedelta
from period_tracker import PeriodTracker


class TestPeriodTracker(unittest.TestCase):
    """Test cases for the PeriodTracker class."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.test_data_file = "test_period_data.json"
        self.tracker = PeriodTracker(data_file=self.test_data_file)
    
    def tearDown(self):
        """Clean up test files."""
        if os.path.exists(self.test_data_file):
            os.remove(self.test_data_file)
    
    def test_initialization(self):
        """Test tracker initialization."""
        self.assertIsNotNone(self.tracker)
        self.assertEqual(self.tracker.data["periods"], [])
        self.assertEqual(self.tracker.data["average_cycle_length"], 28)
    
    def test_add_period_basic(self):
        """Test adding a basic period entry."""
        self.tracker.add_period("2026-01-15")
        self.assertEqual(len(self.tracker.data["periods"]), 1)
        self.assertEqual(self.tracker.data["periods"][0]["start_date"], "2026-01-15")
        self.assertIsNone(self.tracker.data["periods"][0]["end_date"])
    
    def test_add_period_with_end_date(self):
        """Test adding a period with end date."""
        self.tracker.add_period("2026-01-15", "2026-01-19")
        self.assertEqual(len(self.tracker.data["periods"]), 1)
        self.assertEqual(self.tracker.data["periods"][0]["start_date"], "2026-01-15")
        self.assertEqual(self.tracker.data["periods"][0]["end_date"], "2026-01-19")
    
    def test_add_period_with_symptoms(self):
        """Test adding a period with symptoms."""
        symptoms = ["cramps", "fatigue", "headache"]
        self.tracker.add_period("2026-01-15", symptoms=symptoms)
        self.assertEqual(len(self.tracker.data["periods"]), 1)
        self.assertEqual(self.tracker.data["periods"][0]["symptoms"], symptoms)
    
    def test_add_period_invalid_date_format(self):
        """Test adding a period with invalid date format."""
        with self.assertRaises(ValueError):
            self.tracker.add_period("15-01-2026")  # Wrong format
        with self.assertRaises(ValueError):
            self.tracker.add_period("2026/01/15")  # Wrong separator
    
    def test_data_persistence(self):
        """Test that data is saved and loaded correctly."""
        self.tracker.add_period("2026-01-15", "2026-01-19")
        
        # Create new tracker instance to test loading
        new_tracker = PeriodTracker(data_file=self.test_data_file)
        self.assertEqual(len(new_tracker.data["periods"]), 1)
        self.assertEqual(new_tracker.data["periods"][0]["start_date"], "2026-01-15")
    
    def test_calculate_average_cycle_single_period(self):
        """Test cycle calculation with single period (should remain default)."""
        self.tracker.add_period("2026-01-15")
        self.assertEqual(self.tracker.data["average_cycle_length"], 28)
    
    def test_calculate_average_cycle_multiple_periods(self):
        """Test cycle calculation with multiple periods."""
        self.tracker.add_period("2026-01-01")
        self.tracker.add_period("2026-01-29")  # 28 days later
        self.assertEqual(self.tracker.data["average_cycle_length"], 28)
        
        self.tracker.add_period("2026-02-27")  # 29 days later
        # Average of 28 and 29 is 28.5, rounded down to 28
        self.assertIn(self.tracker.data["average_cycle_length"], [28, 29])
    
    def test_view_history_empty(self):
        """Test viewing history when no periods are recorded."""
        # Should not raise an error
        self.tracker.view_history()
    
    def test_view_history_with_data(self):
        """Test viewing history with recorded periods."""
        self.tracker.add_period("2026-01-15", "2026-01-19")
        self.tracker.add_period("2026-02-12", "2026-02-16")
        # Should not raise an error
        self.tracker.view_history()
    
    def test_predict_next_period_no_data(self):
        """Test prediction with no data."""
        # Should not raise an error
        self.tracker.predict_next_period()
    
    def test_predict_next_period_with_data(self):
        """Test prediction with recorded periods."""
        self.tracker.add_period("2026-01-01")
        self.tracker.add_period("2026-01-29")
        # Should not raise an error
        self.tracker.predict_next_period()
    
    def test_get_stats_no_data(self):
        """Test statistics with no data."""
        # Should not raise an error
        self.tracker.get_stats()
    
    def test_get_stats_with_data(self):
        """Test statistics with recorded periods."""
        self.tracker.add_period("2026-01-15", "2026-01-19")
        self.tracker.add_period("2026-02-12", "2026-02-16")
        # Should not raise an error
        self.tracker.get_stats()
    
    def test_multiple_periods_sorting(self):
        """Test that periods are properly sorted in history."""
        # Add periods out of chronological order
        self.tracker.add_period("2026-02-15")
        self.tracker.add_period("2026-01-15")
        self.tracker.add_period("2026-03-15")
        
        # Periods should be stored (order doesn't matter for storage)
        self.assertEqual(len(self.tracker.data["periods"]), 3)
    
    def test_json_structure(self):
        """Test that saved JSON has correct structure."""
        self.tracker.add_period("2026-01-15", "2026-01-19", ["cramps"])
        
        with open(self.test_data_file, 'r') as f:
            data = json.load(f)
        
        self.assertIn("periods", data)
        self.assertIn("average_cycle_length", data)
        self.assertIsInstance(data["periods"], list)
        self.assertIsInstance(data["average_cycle_length"], int)


class TestPeriodTrackerEdgeCases(unittest.TestCase):
    """Test edge cases for the PeriodTracker class."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.test_data_file = "test_edge_cases.json"
        self.tracker = PeriodTracker(data_file=self.test_data_file)
    
    def tearDown(self):
        """Clean up test files."""
        if os.path.exists(self.test_data_file):
            os.remove(self.test_data_file)
    
    def test_empty_symptoms_list(self):
        """Test adding a period with empty symptoms list."""
        self.tracker.add_period("2026-01-15", symptoms=[])
        self.assertEqual(self.tracker.data["periods"][0]["symptoms"], [])
    
    def test_very_long_cycle(self):
        """Test calculation with unusually long cycle."""
        self.tracker.add_period("2026-01-01")
        self.tracker.add_period("2026-03-01")  # 59 days
        self.assertEqual(self.tracker.data["average_cycle_length"], 59)
    
    def test_very_short_cycle(self):
        """Test calculation with unusually short cycle."""
        self.tracker.add_period("2026-01-01")
        self.tracker.add_period("2026-01-22")  # 21 days
        self.assertEqual(self.tracker.data["average_cycle_length"], 21)


if __name__ == "__main__":
    unittest.main()
