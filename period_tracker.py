#!/usr/bin/env python3
"""
Selene - Period Tracker Application

A simple CLI application to track menstrual periods, predict next cycles,
and maintain a history of cycles.
"""

import json
import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional


class PeriodTracker:
    """Main class for tracking menstrual periods."""
    
    def __init__(self, data_file: str = "period_data.json"):
        """Initialize the period tracker with a data file."""
        self.data_file = data_file
        self.data = self._load_data()
    
    def _load_data(self) -> Dict:
        """Load data from JSON file."""
        if os.path.exists(self.data_file):
            with open(self.data_file, 'r') as f:
                return json.load(f)
        return {"periods": [], "average_cycle_length": 28}
    
    def _save_data(self) -> None:
        """Save data to JSON file."""
        with open(self.data_file, 'w') as f:
            json.dump(self.data, f, indent=2)
    
    def add_period(self, start_date: str, end_date: Optional[str] = None, 
                   symptoms: Optional[List[str]] = None) -> None:
        """
        Add a new period entry.
        
        Args:
            start_date: Start date in YYYY-MM-DD format
            end_date: Optional end date in YYYY-MM-DD format
            symptoms: Optional list of symptoms
        """
        # Validate date format
        try:
            datetime.strptime(start_date, "%Y-%m-%d")
            if end_date:
                datetime.strptime(end_date, "%Y-%m-%d")
        except ValueError:
            raise ValueError("Date must be in YYYY-MM-DD format")
        
        period_entry = {
            "start_date": start_date,
            "end_date": end_date,
            "symptoms": symptoms or []
        }
        
        self.data["periods"].append(period_entry)
        self._calculate_average_cycle()
        self._save_data()
        print(f"Period added successfully starting {start_date}")
    
    def _calculate_average_cycle(self) -> None:
        """Calculate average cycle length from recorded periods."""
        periods = self.data["periods"]
        if len(periods) < 2:
            return
        
        # Sort periods by start date
        sorted_periods = sorted(periods, key=lambda x: x["start_date"])
        
        # Calculate cycle lengths
        cycle_lengths = []
        for i in range(len(sorted_periods) - 1):
            start1 = datetime.strptime(sorted_periods[i]["start_date"], "%Y-%m-%d")
            start2 = datetime.strptime(sorted_periods[i + 1]["start_date"], "%Y-%m-%d")
            cycle_length = (start2 - start1).days
            if cycle_length > 0:  # Ensure valid cycle length
                cycle_lengths.append(cycle_length)
        
        if cycle_lengths:
            self.data["average_cycle_length"] = sum(cycle_lengths) // len(cycle_lengths)
    
    def view_history(self, limit: int = 10) -> None:
        """
        Display period history.
        
        Args:
            limit: Maximum number of entries to display
        """
        periods = self.data["periods"]
        if not periods:
            print("No period history recorded yet.")
            return
        
        # Sort by start date (most recent first)
        sorted_periods = sorted(periods, key=lambda x: x["start_date"], reverse=True)
        
        print(f"\n{'='*60}")
        print(f"Period History (showing last {min(limit, len(sorted_periods))} entries)")
        print(f"{'='*60}\n")
        
        for i, period in enumerate(sorted_periods[:limit], 1):
            print(f"{i}. Start: {period['start_date']}")
            if period.get('end_date'):
                print(f"   End: {period['end_date']}")
            if period.get('symptoms'):
                print(f"   Symptoms: {', '.join(period['symptoms'])}")
            print()
    
    def predict_next_period(self) -> None:
        """Predict the next period based on cycle history."""
        periods = self.data["periods"]
        if not periods:
            print("No period history available. Cannot make prediction.")
            return
        
        # Get the most recent period
        sorted_periods = sorted(periods, key=lambda x: x["start_date"])
        last_period = sorted_periods[-1]
        last_start = datetime.strptime(last_period["start_date"], "%Y-%m-%d")
        
        avg_cycle = self.data["average_cycle_length"]
        next_period = last_start + timedelta(days=avg_cycle)
        
        print(f"\n{'='*60}")
        print(f"Next Period Prediction")
        print(f"{'='*60}")
        print(f"Last period started: {last_period['start_date']}")
        print(f"Average cycle length: {avg_cycle} days")
        print(f"Predicted next period: {next_period.strftime('%Y-%m-%d')}")
        print(f"{'='*60}\n")
    
    def get_stats(self) -> None:
        """Display statistics about tracked periods."""
        periods = self.data["periods"]
        if not periods:
            print("No period data available yet.")
            return
        
        print(f"\n{'='*60}")
        print(f"Period Statistics")
        print(f"{'='*60}")
        print(f"Total periods tracked: {len(periods)}")
        print(f"Average cycle length: {self.data['average_cycle_length']} days")
        
        # Calculate average period length if end dates are available
        periods_with_duration = [p for p in periods if p.get('end_date')]
        if periods_with_duration:
            durations = []
            for p in periods_with_duration:
                start = datetime.strptime(p["start_date"], "%Y-%m-%d")
                end = datetime.strptime(p["end_date"], "%Y-%m-%d")
                durations.append((end - start).days + 1)
            avg_duration = sum(durations) // len(durations)
            print(f"Average period duration: {avg_duration} days")
        
        print(f"{'='*60}\n")


def main():
    """Main CLI interface."""
    tracker = PeriodTracker()
    
    print("\n" + "="*60)
    print("SELENE - Period Tracker".center(60))
    print("="*60 + "\n")
    
    while True:
        print("\nOptions:")
        print("1. Add new period")
        print("2. View period history")
        print("3. Predict next period")
        print("4. View statistics")
        print("5. Exit")
        
        choice = input("\nEnter your choice (1-5): ").strip()
        
        if choice == "1":
            print("\n--- Add New Period ---")
            start_date = input("Enter start date (YYYY-MM-DD): ").strip()
            end_date = input("Enter end date (YYYY-MM-DD, or press Enter to skip): ").strip()
            symptoms_input = input("Enter symptoms separated by commas (or press Enter to skip): ").strip()
            
            end_date = end_date if end_date else None
            symptoms = [s.strip() for s in symptoms_input.split(",")] if symptoms_input else None
            
            try:
                tracker.add_period(start_date, end_date, symptoms)
            except ValueError as e:
                print(f"Error: {e}")
        
        elif choice == "2":
            tracker.view_history()
        
        elif choice == "3":
            tracker.predict_next_period()
        
        elif choice == "4":
            tracker.get_stats()
        
        elif choice == "5":
            print("\nThank you for using Selene. Stay healthy!")
            break
        
        else:
            print("\nInvalid choice. Please enter a number between 1 and 5.")


if __name__ == "__main__":
    main()
