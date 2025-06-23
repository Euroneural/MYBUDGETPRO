export class TransactionGraph {
    constructor(container, data) {
        this.container = container;
        this.data = data || { transactions: [], categories: [], accounts: [] };
        this.width = container.clientWidth;
        this.height = 600;
        this.nodeRadius = 8;
        this.simulation = null;
        this.zoom = null;
        this.svg = null;
        this.linksGroup = null;
        this.nodesGroup = null;
        this.labelsGroup = null;
        this.colorScale = null;
        
        this.init();
    }

    init() {
        // Set up the SVG container
        this.setupSVG();
        
        // Set up color scale
        this.setupColorScale();
        
        // Process the data
        this.processData();
        
        // Draw the graph
        this.drawGraph();
    }

    setupSVG() {
        // Clear any existing content
        this.container.innerHTML = '';
        
        // Create SVG element
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', this.height)
            .attr('viewBox', `0 0 ${this.width} ${this.height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');
        
        // Add zoom behavior
        this.zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                this.g.attr('transform', event.transform);
            });
        
        this.svg.call(this.zoom);
        
        // Create main group that will be transformed by zoom
        this.g = this.svg.append('g');
        
        // Create groups for links and nodes
        this.linksGroup = this.g.append('g').attr('class', 'links');
        this.nodesGroup = this.g.append('g').attr('class', 'nodes');
        this.labelsGroup = this.g.append('g').attr('class', 'labels');
    }

    setupColorScale() {
        // Create a color scale for categories
        this.colorScale = d3.scaleOrdinal()
            .domain(this.data.categories)
            .range(d3.schemeCategory10);
    }

    processData() {
        // Process transactions into nodes and links
        this.nodes = this.data.transactions.map((tx, i) => ({
            id: tx.id || `tx-${i}`,
            label: tx.description || `Transaction ${i + 1}`,
            amount: tx.amount || 0,
            category: tx.category || 'Uncategorized',
            date: tx.date || new Date().toISOString(),
            x: Math.random() * this.width,
            y: Math.random() * this.height
        }));
        
        // Create links between related transactions (simplified example)
        this.links = [];
        for (let i = 0; i < this.nodes.length - 1; i++) {
            if (Math.random() > 0.7) { // Randomly connect some nodes
                this.links.push({
                    source: this.nodes[i].id,
                    target: this.nodes[i + 1].id,
                    value: 1
                });
            }
        }
    }

    drawGraph() {
        // Draw links
        const linkElements = this.linksGroup
            .selectAll('line')
            .data(this.links, d => `${d.source.id || d.source}-${d.target.id || d.target}`)
            .join('line')
            .attr('stroke', '#999')
            .attr('stroke-width', 1);
        
        // Draw nodes
        const nodeElements = this.nodesGroup
            .selectAll('circle')
            .data(this.nodes, d => d.id)
            .join('circle')
            .attr('r', this.nodeRadius)
            .attr('fill', d => this.colorScale(d.category) || '#ccc')
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5)
            .call(d3.drag()
                .on('start', (event, d) => this.dragstarted(event, d))
                .on('drag', (event, d) => this.dragged(event, d))
                .on('end', (event, d) => this.dragended(event, d))
            )
            .on('mouseover', (event, d) => this.showTooltip(event, d))
            .on('mouseout', () => this.hideTooltip());
        
        // Add labels
        const labelElements = this.labelsGroup
            .selectAll('text')
            .data(this.nodes, d => d.id)
            .join('text')
            .attr('font-size', 10)
            .attr('dx', this.nodeRadius + 2)
            .attr('dy', '.35em')
            .text(d => d.label);
        
        // Set up the force simulation
        this.simulation = d3.forceSimulation(this.nodes)
            .force('link', d3.forceLink(this.links).id(d => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(this.width / 2, this.height / 2))
            .force('collision', d3.forceCollide().radius(this.nodeRadius * 1.5))
            .on('tick', () => {
                // Update link positions
                linkElements
                    .attr('x1', d => d.source.x)
                    .attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x)
                    .attr('y2', d => d.target.y);
                
                // Update node positions
                nodeElements
                    .attr('cx', d => d.x)
                    .attr('cy', d => d.y);
                
                // Update label positions
                labelElements
                    .attr('x', d => d.x)
                    .attr('y', d => d.y);
            });
    }

    updateGraph(newData) {
        if (newData) {
            this.data = newData;
            this.processData();
            
            // Update color scale if categories changed
            const newCategories = [...new Set(this.data.transactions.map(tx => tx.category))];
            if (newCategories.length !== this.data.categories.length || 
                newCategories.some(cat => !this.data.categories.includes(cat))) {
                this.data.categories = newCategories;
                this.setupColorScale();
            }
            
            // Redraw the graph
            this.drawGraph();
        }
    }

    highlightNode(nodeId) {
        // Reset all nodes
        this.nodesGroup.selectAll('circle')
            .attr('r', this.nodeRadius)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5);
        
        // Highlight the selected node
        if (nodeId) {
            this.nodesGroup.selectAll(`circle[data-id="${nodeId}"]`)
                .attr('r', this.nodeRadius * 1.5)
                .attr('stroke', '#ff0')
                .attr('stroke-width', 2);
        }
    }

    // Drag event handlers
    dragstarted(event, d) {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    dragended(event, d) {
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    // Tooltip methods
    showTooltip(event, d) {
        // Create or show tooltip
        let tooltip = d3.select('.graph-tooltip');
        if (tooltip.empty()) {
            tooltip = d3.select('body').append('div')
                .attr('class', 'graph-tooltip')
                .style('opacity', 0);
        }
        
        tooltip.transition()
            .duration(200)
            .style('opacity', .9);
            
        tooltip.html(`
            <div><strong>${d.label}</strong></div>
            <div>Amount: ${d.amount}</div>
            <div>Category: ${d.category}</div>
            <div>Date: ${new Date(d.date).toLocaleDateString()}</div>
        `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 28) + 'px');
    }

    hideTooltip() {
        d3.select('.graph-tooltip').remove();
    }

    // Clean up
    destroy() {
        if (this.simulation) {
            this.simulation.stop();
        }
        if (this.svg) {
            this.svg.remove();
        }
    }
}
