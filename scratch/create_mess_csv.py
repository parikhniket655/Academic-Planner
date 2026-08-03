import csv

menu_data = [
    # MONDAY
    ("MONDAY", "BREAKFAST", "Beverages", "Tea, Coffee, Milk, Bournvita"),
    ("MONDAY", "BREAKFAST", "Breads", "Brown Bread, Butter, Jam"),
    ("MONDAY", "BREAKFAST", "Cornflakes", "Chocos"),
    ("MONDAY", "BREAKFAST", "Fruits/Salad", "Papaya"),
    ("MONDAY", "BREAKFAST", "Egg Dish", "Masala Omelette"),
    ("MONDAY", "BREAKFAST", "Main Dish", "Idli"),
    ("MONDAY", "BREAKFAST", "Side Items", "Sambhar + Coconut Chutney"),
    
    ("MONDAY", "LUNCH", "Daal", "Arhar Dal"),
    ("MONDAY", "LUNCH", "Gravy", "Chicken Chilly"),
    ("MONDAY", "LUNCH", "Dry Veg", "Veg Manchurian"),
    ("MONDAY", "LUNCH", "Rice", "Fried Rice"),
    ("MONDAY", "LUNCH", "Curd Item", "Pineapple Raita"),
    ("MONDAY", "LUNCH", "Breads", "Roti"),
    ("MONDAY", "LUNCH", "Salad", "Kachumbar Salad"),
    
    ("MONDAY", "SNACKS", "Drinks", "Tea, Coffee, Milk, Bournvita"),
    ("MONDAY", "SNACKS", "Breads", "Bread, Butter, Jam"),
    ("MONDAY", "SNACKS", "Main Snack", "Bhel Puri"),
    ("MONDAY", "SNACKS", "Side Items", "Ketchup + Mint Chutney"),
    
    ("MONDAY", "DINNER", "Daal", "Daal Palak"),
    ("MONDAY", "DINNER", "Gravy", "Lauki Kofta"),
    ("MONDAY", "DINNER", "Rice", "Plain Rice"),
    ("MONDAY", "DINNER", "Breads", "Roti"),
    ("MONDAY", "DINNER", "Salad", "Green Salad"),
    ("MONDAY", "DINNER", "Sweets", "Jalebi"),

    # TUESDAY
    ("TUESDAY", "BREAKFAST", "Beverages", "Tea, Coffee, Milk, Bournvita"),
    ("TUESDAY", "BREAKFAST", "Breads", "Brown Bread, Butter, Jam"),
    ("TUESDAY", "BREAKFAST", "Cornflakes", "Cornflakes"),
    ("TUESDAY", "BREAKFAST", "Fruits/Salad", "Banana"),
    ("TUESDAY", "BREAKFAST", "Egg Dish", "Boiled eggs - 2"),
    ("TUESDAY", "BREAKFAST", "Main Dish", "Aaloo Pyaaz Paratha"),
    ("TUESDAY", "BREAKFAST", "Side Items", "Matar Sabzi + Pickle"),
    
    ("TUESDAY", "LUNCH", "Daal", "Amritsari Chole"),
    ("TUESDAY", "LUNCH", "Rice", "Plain Rice"),
    ("TUESDAY", "LUNCH", "Curd Item", "Chaach"),
    ("TUESDAY", "LUNCH", "Breads", "Bhature"),
    ("TUESDAY", "LUNCH", "Salad", "Green Salad"),
    
    ("TUESDAY", "SNACKS", "Drinks", "Tea, Coffee, Milk, Bournvita"),
    ("TUESDAY", "SNACKS", "Breads", "Bread, Butter, Jam"),
    ("TUESDAY", "SNACKS", "Main Snack", "Aaloo Pakode"),
    ("TUESDAY", "SNACKS", "Side Items", "Ketchup + Mint Chutney"),
    
    ("TUESDAY", "DINNER", "Daal", "Urad Dal"),
    ("TUESDAY", "DINNER", "Gravy", "Aloo Soyabean"),
    ("TUESDAY", "DINNER", "Rice", "Matar Pulao"),
    ("TUESDAY", "DINNER", "Breads", "Roti"),
    ("TUESDAY", "DINNER", "Salad", "Green Salad"),
    ("TUESDAY", "DINNER", "Sweets", "Sewaiyan/Kheer"),

    # WEDNESDAY
    ("WEDNESDAY", "BREAKFAST", "Beverages", "Tea, Coffee, Milk, Bournvita"),
    ("WEDNESDAY", "BREAKFAST", "Breads", "Brown Bread, Butter, Jam"),
    ("WEDNESDAY", "BREAKFAST", "Cornflakes", "Chocos"),
    ("WEDNESDAY", "BREAKFAST", "Fruits/Salad", "Papaya"),
    ("WEDNESDAY", "BREAKFAST", "Egg Dish", "Masala Omelette"),
    ("WEDNESDAY", "BREAKFAST", "Main Dish", "Upma"),
    ("WEDNESDAY", "BREAKFAST", "Side Items", "Sambhar + Coconut Chutney"),
    
    ("WEDNESDAY", "LUNCH", "Daal", "Kadhi Pakoda"),
    ("WEDNESDAY", "LUNCH", "Dry Veg", "Aaloo Jeera"),
    ("WEDNESDAY", "LUNCH", "Rice", "Jeera Rice"),
    ("WEDNESDAY", "LUNCH", "Curd Item", "Cucumber & Mint Raita"),
    ("WEDNESDAY", "LUNCH", "Breads", "Roti"),
    ("WEDNESDAY", "LUNCH", "Salad", "Kachumbar Salad"),
    
    ("WEDNESDAY", "SNACKS", "Drinks", "Tea, Coffee, Milk, Bournvita"),
    ("WEDNESDAY", "SNACKS", "Breads", "Bread, Butter, Jam"),
    ("WEDNESDAY", "SNACKS", "Main Snack", "Chowmein/Maggi"),
    ("WEDNESDAY", "SNACKS", "Side Items", "Ketchup"),
    
    ("WEDNESDAY", "DINNER", "Daal", "Masoor Dal Fry"),
    ("WEDNESDAY", "DINNER", "Gravy", "Chicken Do Pyaza"),
    ("WEDNESDAY", "DINNER", "Dry Veg", "Paneer Lababdar"),
    ("WEDNESDAY", "DINNER", "Rice", "Tawa Pulao"),
    ("WEDNESDAY", "DINNER", "Breads", "Roti"),
    ("WEDNESDAY", "DINNER", "Salad", "Green Salad"),
    ("WEDNESDAY", "DINNER", "Sweets", "Besan Barfi/Boondi"),

    # THURSDAY
    ("THURSDAY", "BREAKFAST", "Beverages", "Tea, Coffee, Milk, Bournvita"),
    ("THURSDAY", "BREAKFAST", "Breads", "Brown Bread, Butter, Jam"),
    ("THURSDAY", "BREAKFAST", "Cornflakes", "Cornflakes"),
    ("THURSDAY", "BREAKFAST", "Fruits/Salad", "Fruit Chat - 1 Bowl"),
    ("THURSDAY", "BREAKFAST", "Egg Dish", "Bhurji"),
    ("THURSDAY", "BREAKFAST", "Main Dish", "Aaloo Pyaz Paratha"),
    ("THURSDAY", "BREAKFAST", "Side Items", "Curd + Pickle"),
    
    ("THURSDAY", "LUNCH", "Daal", "Rajma"),
    ("THURSDAY", "LUNCH", "Dry Veg", "Lauki"),
    ("THURSDAY", "LUNCH", "Rice", "Plain Rice"),
    ("THURSDAY", "LUNCH", "Curd Item", "Dahi vada"),
    ("THURSDAY", "LUNCH", "Breads", "Roti"),
    ("THURSDAY", "LUNCH", "Salad", "Green salad"),
    
    ("THURSDAY", "SNACKS", "Drinks", "Tea, Coffee, Milk, Bournvita"),
    ("THURSDAY", "SNACKS", "Breads", "Bread, Butter, Jam"),
    ("THURSDAY", "SNACKS", "Main Snack", "Bread Pakode"),
    ("THURSDAY", "SNACKS", "Side Items", "Ketchup + Mint Chutney"),
    
    ("THURSDAY", "DINNER", "Daal", "Lehsuni Dal"),
    ("THURSDAY", "DINNER", "Gravy", "Aaloo Palwal"),
    ("THURSDAY", "DINNER", "Rice", "Jeera Rice"),
    ("THURSDAY", "DINNER", "Breads", "Roti"),
    ("THURSDAY", "DINNER", "Salad", "Green Salad"),
    ("THURSDAY", "DINNER", "Sweets", "Vanilla/Strawberry Ice Cream"),

    # FRIDAY
    ("FRIDAY", "BREAKFAST", "Beverages", "Tea, Coffee, Milk, Bournvita"),
    ("FRIDAY", "BREAKFAST", "Breads", "Brown Bread, Butter, Jam"),
    ("FRIDAY", "BREAKFAST", "Cornflakes", "Chocos"),
    ("FRIDAY", "BREAKFAST", "Fruits/Salad", "Banana"),
    ("FRIDAY", "BREAKFAST", "Egg Dish", "Bhurji"),
    ("FRIDAY", "BREAKFAST", "Main Dish", "Uttapam"),
    ("FRIDAY", "BREAKFAST", "Side Items", "Sambhar + Coconut Chutney"),
    
    ("FRIDAY", "LUNCH", "Daal", "Daal Tadka"),
    ("FRIDAY", "LUNCH", "Gravy", "Aaloo Matar Sabzi"),
    ("FRIDAY", "LUNCH", "Rice", "Jeera Rice"),
    ("FRIDAY", "LUNCH", "Curd Item", "Plain Dahi"),
    ("FRIDAY", "LUNCH", "Breads", "Methi Puri"),
    ("FRIDAY", "LUNCH", "Salad", "Green Salad"),
    
    ("FRIDAY", "SNACKS", "Drinks", "Tea, Coffee, Milk, Bournvita"),
    ("FRIDAY", "SNACKS", "Breads", "Bread, Butter, Jam"),
    ("FRIDAY", "SNACKS", "Main Snack", "Pasta"),
    ("FRIDAY", "SNACKS", "Side Items", "Ketchup"),
    
    ("FRIDAY", "DINNER", "Daal", "Masoor Dal Fry"),
    ("FRIDAY", "DINNER", "Gravy", "Chicken Do Pyaza"),
    ("FRIDAY", "DINNER", "Dry Veg", "Paneer Lababdar"),
    ("FRIDAY", "DINNER", "Rice", "Plain Rice"),
    ("FRIDAY", "DINNER", "Breads", "Roti"),
    ("FRIDAY", "DINNER", "Salad", "Green Salad"),
    ("FRIDAY", "DINNER", "Sweets", "Fruit Custard"),

    # SATURDAY
    ("SATURDAY", "BREAKFAST", "Beverages", "Tea, Coffee, Milk, Bournvita"),
    ("SATURDAY", "BREAKFAST", "Breads", "Brown Bread, Butter, Jam"),
    ("SATURDAY", "BREAKFAST", "Cornflakes", "Cornflakes"),
    ("SATURDAY", "BREAKFAST", "Fruits/Salad", "Papaya"),
    ("SATURDAY", "BREAKFAST", "Egg Dish", "Boiled eggs - 2"),
    ("SATURDAY", "BREAKFAST", "Main Dish", "Aaloo Pyaaz Paratha"),
    ("SATURDAY", "BREAKFAST", "Side Items", "Matar Sabzi + Pickle"),
    
    ("SATURDAY", "LUNCH", "Daal", "Mixed Dal"),
    ("SATURDAY", "LUNCH", "Dry Veg", "Dum Aaloo"),
    ("SATURDAY", "LUNCH", "Rice", "Plain Rice"),
    ("SATURDAY", "LUNCH", "Curd Item", "Boondi Raita"),
    ("SATURDAY", "LUNCH", "Breads", "Roti"),
    ("SATURDAY", "LUNCH", "Salad", "Boiled Chana Salad"),
    
    ("SATURDAY", "SNACKS", "Drinks", "Tea, Coffee, Milk, Bournvita"),
    ("SATURDAY", "SNACKS", "Breads", "Bread, Butter, Jam"),
    ("SATURDAY", "SNACKS", "Main Snack", "Vada Pav"),
    ("SATURDAY", "SNACKS", "Side Items", "Lemon /Ketchup +Mint Chutney"),
    
    ("SATURDAY", "DINNER", "Daal", "Dal Makhani"),
    ("SATURDAY", "SATURDAY", "Gravy", "Tori Chana/Aaloo"),
    ("SATURDAY", "DINNER", "Rice", "Plain Rice"),
    ("SATURDAY", "DINNER", "Breads", "Roti"),
    ("SATURDAY", "DINNER", "Salad", "Green Salad"),
    ("SATURDAY", "DINNER", "Sweets", "Gulab Jamun"),

    # SUNDAY
    ("SUNDAY", "BREAKFAST", "Beverages", "Tea, Coffee, Milk, Bournvita"),
    ("SUNDAY", "BREAKFAST", "Breads", "Brown Bread, Butter, Jam"),
    ("SUNDAY", "BREAKFAST", "Cornflakes", "Chocos"),
    ("SUNDAY", "BREAKFAST", "Fruits/Salad", "Banana"),
    ("SUNDAY", "BREAKFAST", "Egg Dish", "Bhurji"),
    ("SUNDAY", "BREAKFAST", "Main Dish", "Dosa"),
    ("SUNDAY", "BREAKFAST", "Side Items", "Aaloo masala + Coconut Chutney + Sambhar"),
    
    ("SUNDAY", "LUNCH", "Daal", "Toor Dal"),
    ("SUNDAY", "LUNCH", "Gravy", "Matar Paneer"),
    ("SUNDAY", "LUNCH", "Rice", "Veg Biryani + Chicken Biryani"),
    ("SUNDAY", "LUNCH", "Curd Item", "Mix Veg Raita"),
    ("SUNDAY", "LUNCH", "Breads", "Roti"),
    ("SUNDAY", "LUNCH", "Salad", "Kachumbar Salad"),
    ("SUNDAY", "LUNCH", "Sweets", "Chocolate Icecream"),
    
    ("SUNDAY", "SNACKS", "Drinks", "Tea, Coffee, Milk, Bournvita"),
    ("SUNDAY", "SNACKS", "Breads", "Bread, Butter, Jam"),
    ("SUNDAY", "SNACKS", "Main Snack", "Samosa/Kachori"),
    ("SUNDAY", "SNACKS", "Side Items", "Imli Chutney + Mint Chutney"),
    
    ("SUNDAY", "DINNER", "Daal", "Urad Dal"),
    ("SUNDAY", "DINNER", "Gravy", "Cabbage matar Aaloo"),
    ("SUNDAY", "DINNER", "Rice", "Jeera Rice"),
    ("SUNDAY", "DINNER", "Breads", "Roti"),
    ("SUNDAY", "DINNER", "Salad", "Green Salad"),
    ("SUNDAY", "DINNER", "Sweets", "Sooji/Moong Dal Halwa"),
]

output_file = "/Users/ketanparikh/Desktop/Antigravity Work/planner/mess_menu.csv"
with open(output_file, mode="w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["Day", "Meal Type", "Category", "Items"])
    for row in menu_data:
        writer.writerow(row)

print("Created mess_menu.csv successfully!")
