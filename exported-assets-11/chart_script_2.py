import plotly.express as px
import pandas as pd

# Create dataframe from the provided JSON data
data = [
    {"category": "Housing", "amount": 1500, "percentage": 53.2},
    {"category": "Food & Dining", "amount": 287, "percentage": 10.2},
    {"category": "Groceries", "amount": 245, "percentage": 8.7},
    {"category": "Transportation", "amount": 165, "percentage": 5.9},
    {"category": "Entertainment", "amount": 98, "percentage": 3.5},
    {"category": "Utilities", "amount": 225, "percentage": 8.0},
    {"category": "Other", "amount": 300, "percentage": 10.6}
]

df = pd.DataFrame(data)

# Define brand colors in order
colors = ['#1FB8CD', '#FFC185', '#ECEBD5', '#5D878F', '#D2BA4C', '#B4413C', '#964325']

# Create pie chart
fig = px.pie(df, 
             values='percentage', 
             names='category',
             title='Monthly Expense Distribution',
             color_discrete_sequence=colors)

# Update traces to show percentage labels inside slices
fig.update_traces(
    textposition='inside',
    textinfo='percent+label'
)

# Update layout for pie chart specific styling
fig.update_layout(
    uniformtext_minsize=14, 
    uniformtext_mode='hide'
)

# Save the chart
fig.write_image('monthly_expense_pie_chart.png')