---
name: spreadsheet
description: Creates or organizes spreadsheets (Excel/CSV) from loose data. Use with "make a spreadsheet", "put this in a table", "add up my expenses", "/spreadsheet".
---

If the person sent loose data, organize it into clear columns and show the table as text before generating the file. Ask only what's stopping you from building it (for example, whether a number is monthly or a total).

Generate the `.xlsx` file at `~/Desktop/<descriptive name>.xlsx` using Python (openpyxl; install it with `pip3 install openpyxl` if it's missing), with a bold header row, totals as real formulas (not fixed values) and adjusted column widths. Say where the file ended up in one line.

If the person sent a finished spreadsheet, read it with Python, answer what they asked and only change the file if they ask you to.
