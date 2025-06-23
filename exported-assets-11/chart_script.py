import plotly.graph_objects as go
import plotly.express as px

# Data
data = [
    {"category": "Housing", "budgeted": 1600, "actual": 1500},
    {"category": "Food & Dining", "budgeted": 400, "actual": 287},
    {"category": "Groceries", "budgeted": 300, "actual": 245},
    {"category": "Transportation", "budgeted": 200, "actual": 165},
    {"category": "Entertainment", "budgeted": 150, "actual": 98},
    {"category": "Utilities", "budgeted": 250, "actual": 225}
]

# Extract categories and values
categories = [item["category"] for item in data]
budgeted = [item["budgeted"] for item in data]
actual = [item["actual"] for item in data]

# Create figure
fig = go.Figure()

# Add budgeted bars
fig.add_trace(go.Bar(
    x=categories,
    y=budgeted,
    name='Budgeted',
    marker_color='#1FB8CD',
    cliponaxis=False
))

# Add actual bars
fig.add_trace(go.Bar(
    x=categories,
    y=actual,
    name='Actual',
    marker_color='#FFC185',
    cliponaxis=False
))

# Update layout
fig.update_layout(
    title='Budget vs Actual Spending by Category',
    xaxis_title='Category',
    yaxis_title='Amount ($)',
    barmode='group',
    legend=dict(orientation='h', yanchor='bottom', y=1.05, xanchor='center', x=0.5)
)

# Update y-axis to show dollar format and set range
fig.update_yaxes(
    range=[0, 1800],
    tickformat='$,.0f'
)

# Save the chart
fig.write_image("budget_performance_chart.png")