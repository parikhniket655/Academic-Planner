import openpyxl

wb = openpyxl.load_workbook("/Users/ketanparikh/Desktop/Antigravity Work/Course wise combined list Term IV PGP 16.xlsx", read_only=True)
print("Sheet names in PGP 16.xlsx:", wb.sheetnames)
