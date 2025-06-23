import * as d3 from 'd3';

export class TransactionGraph {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Container with id '${containerId}' not found`);
            return;
        }

        // Default options
        this.options = {
            width: this.container.clientWidth,
            height: 500,
            nodeRadius: 8,
            linkDistance: 100,
            ...options
        };

        // Initialize the graph
        this.initGraph();
    }

    initGraph() {
        // Clear any existing content
        this.container.innerHTML = '';

        // Create SVG container
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', this.options.height)
            .attr('viewBox', [0, 0, this.options.width, this.options.height])
            .call(d3.zoom()
                .scaleExtent([0.1, 4])
                .on('zoom', (event) => {
                    this.g.attr('transform', event.transform);
                })
            );

        // Add a group for the graph elements
        this.g = this.svg.append('g');

        // Add arrows for directed edges
        this.defs = this.svg.append('defs');
        this.defs.append('marker')
            .attr('id', 'arrowhead')
            .attr('viewBox', '-0 -5 10 10')
            .attr('refX', 15)
            .attr('refY', 0)
            .attr('orient', 'auto')
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .append('svg:path')
            .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
            .attr('fill', '#999');
    }

    updateGraph(data) {
        if (!data) return;

        // Process nodes and links
        const { nodes, links } = this.processGraphData(data);

        // Create the force simulation
        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(150))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(this.options.width / 2, this.options.height / 2))
            .force('collision', d3.forceCollide().radius(d => d.radius || 10));

        // Create links
        const link = this.g.append('g')
            .selectAll('line')
            .data(links)
            .join('line')
            .attr('stroke', '#999')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', d => Math.sqrt(d.value) || 1)
            .attr('marker-end', 'url(#arrowhead)');

        // Create node groups
        const node = this.g.append('g')
            .selectAll('g')
            .data(nodes)
            .join('g')
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended)
            );

        // Add circles to nodes
        node.append('circle')
            .attr('r', d => d.radius || 10)
            .attr('fill', d => this.getNodeColor(d))
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5);

        // Add labels
        node.append('text')
            .text(d => d.name || d.id)
            .attr('font-size', '10px')
            .attr('dx', 12)
            .attr('dy', '.35em');

        // Add tooltips
        node.append('title')
            .text(d => d.description || d.id);

        // Update positions on simulation tick
        simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node
                .attr('transform', d => `translate(${d.x},${d.y})`);
        });

        // Drag functions
        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }
    }

    processGraphData(data) {
        // This is a placeholder - implement your specific data processing logic here
        // The function should return { nodes: [], links: [] }
        
        // Example implementation:
        const nodes = [];
        const links = [];
        const nodeMap = new Map();
        let nodeId = 0;

        // Process transactions into nodes
        data.transactions.forEach((tx, i) => {
            const nodeId = `tx_${i}`;
            nodes.push({
                id: nodeId,
                name: tx.description,
                type: 'transaction',
                amount: tx.amount,
                date: tx.date,
                category: tx.category,
                radius: Math.min(20, Math.max(5, Math.log(Math.abs(tx.amount) + 1) * 2))
            });
            nodeMap.set(nodeId, nodes[nodes.length - 1]);
        });

        // Create links based on relationships
        // This is a simplified example - you'll want to implement your own relationship logic
        for (let i = 0; i < nodes.length - 1; i++) {
            if (i % 3 === 0) {  // Example: create a link every 3 nodes
                links.push({
                    source: nodes[i].id,
                    target: nodes[i + 1].id,
                    value: 1
                });
            }
        }

        return { nodes, links };
    }

    getNodeColor(node) {
        // Customize node colors based on your data
        const colors = {
            transaction: '#4e79a7',
            category: '#f28e2c',
            account: '#e15759',
            default: '#bab0ab'
        };
        return colors[node.type] || colors.default;
    }

    resize() {
        // Handle window resize
        this.options.width = this.container.clientWidth;
        this.svg.attr('width', this.options.width);
        this.updateGraph(this.currentData);
    }
}
