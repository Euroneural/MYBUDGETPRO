import plotly.graph_objects as go
import pandas as pd

# Create data from the provided JSON
data = [
    {"month": "January", "Housing": 1500, "Food & Dining": 320, "Transportation": 180, "Entertainment": 95},
    {"month": "February", "Housing": 1500, "Food & Dining": 285, "Transportation": 165, "Entertainment": 110},
    {"month": "March", "Housing": 1500, "Food & Dining": 345, "Transportation": 195, "Entertainment": 125},
    {"month": "April", "Housing": 1500, "Food & Dining": 310, "Transportation": 175, "Entertainment": 85},
    {"month": "May", "Housing": 1500, "Food & Dining": 290, "Transportation": 205, "Entertainment": 140},
    {"month": "June", "Housing": 1500, "Food & Dining": 287, "Transportation": 165, "Entertainment": 98}
]

df = pd.DataFrame(data)

# Brand colors in order
colors = ["#1FB8CD", "#FFC185", "#5D878F", "#D2BA4C"]
categories = ["Housing", "Food & Dining", "Transportation", "Entertainment"]

# Create the line chart
fig = go.Figure()

# Add lines for each category
for i, category in enumerate(categories):
    fig.add_trace(go.Scatter(
        x=df['month'],
        y=df[category],
        mode='lines+markers',
        name=category,
        line=dict(color=colors[i], width=3),
        marker=dict(size=8, color=colors[i]),
        cliponaxis=False
    ))

# Update layout
fig.update_layout(
    title="Monthly Spending Trends by Category",
    xaxis_title="Month",
    yaxis_title="Amount ($)",
    showlegend=True,
    legend=dict(orientation='h', yanchor='bottom', y=1.05, xanchor='center', x=0.5)
)

# Update axes
fig.update_xaxes(showgrid=True)
fig.update_yaxes(showgrid=True, range=[0, 4000])

# Save the chart
fig.write_image("spending_trends.png")