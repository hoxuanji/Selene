# Selene - Period Tracker App

Selene is a simple, privacy-focused command-line period tracker application. Track your menstrual cycles, view history, and predict future periods.

## Features

- 📅 **Log Period Dates**: Record start and end dates of your periods
- 📊 **Track Symptoms**: Note symptoms associated with each period
- 📈 **View History**: See your complete period history
- 🔮 **Predict Next Period**: Get predictions based on your cycle patterns
- 📉 **Statistics**: View average cycle length and period duration

## Installation

Selene requires Python 3.6 or higher. No external dependencies are needed.

```bash
git clone https://github.com/hoxuanji/Selene.git
cd Selene
```

## Usage

### Running the Application

```bash
python3 period_tracker.py
```

### Interactive Menu

The application provides an interactive menu with the following options:

1. **Add new period**: Log a new period with start date, optional end date, and symptoms
2. **View period history**: See your most recent period entries
3. **Predict next period**: Get a prediction for your next period based on your cycle history
4. **View statistics**: See statistics like average cycle length and period duration
5. **Exit**: Close the application

### Example Usage

```
SELENE - Period Tracker

Options:
1. Add new period
2. View period history
3. Predict next period
4. View statistics
5. Exit

Enter your choice (1-5): 1

--- Add New Period ---
Enter start date (YYYY-MM-DD): 2026-01-15
Enter end date (YYYY-MM-DD, or press Enter to skip): 2026-01-19
Enter symptoms separated by commas (or press Enter to skip): cramps, fatigue
Period added successfully starting 2026-01-15
```

## Data Storage

All period data is stored locally in a `period_data.json` file in the same directory as the application. Your data never leaves your computer, ensuring complete privacy.

## Requirements

- Python 3.6+
- No external dependencies

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.