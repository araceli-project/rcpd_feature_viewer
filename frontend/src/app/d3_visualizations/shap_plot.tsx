import { TrainResponse } from "../services/trainService";
import * as d3 from "d3";


export function renderShapPlot(
    trainResponse: TrainResponse,
    options: { width: number; height: number }
): SVGSVGElement {
    const { shap_agg } = trainResponse;
    const margin = { top: 20, right: 30, bottom: 40, left: 90 };
    const width = options.width - margin.left - margin.right;
    const height = options.height - margin.top - margin.bottom;

    // Create SVG element
    const svg = d3.create("svg")
        .attr("width", options.width)
        .attr("height", options.height);

    const plotGroup = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Process data
    const data = Object.entries(shap_agg).map(([feature, value]) => ({
        feature,
        value,
    }));

    // Create scales
    const maxAbsValue = d3.max(data, (d) => Math.abs(d.value)) || 0;
    const domainMax = maxAbsValue === 0 ? 1 : maxAbsValue;
    const x = d3.scaleLinear()
        .domain([0, domainMax])
        .range([0, width]);

    const y = d3.scaleBand()
        .domain(data.map(d => d.feature))
        .range([0, height])
        .padding(0.1);

    // Add bars
    plotGroup.selectAll(".bar")
        .data(data)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => x(Math.min(0, d.value)))
        .attr("y", d => y(d.feature) ?? 0)
        .attr("width", d => Math.abs(x(d.value) - x(0)))
        .attr("height", y.bandwidth())
        .attr("fill", d => (d.value > 0 ? "steelblue" : "indianred"));

    // Add axes
    plotGroup.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(5));

    plotGroup.append("g")
        .call(d3.axisLeft(y));

    return svg.node() as SVGSVGElement;
}
