import * as d3 from "d3";
import type { FeatureData, RenderFeatureDataOptions } from "./feature_data";

export function multipleDataBarChart(
  featureData: FeatureData,
  proxyTaskName: string,
  selected_points: number[],
  options: RenderFeatureDataOptions = {},
): SVGSVGElement {
  const multipleResults = featureData.multiple_results[proxyTaskName];
  if (!multipleResults) {
    throw new Error(
      `Proxy task "${proxyTaskName}" was not found in multiple results.`,
    );
  }

  const selectedLabels = selected_points.map((index) =>
    index < multipleResults.length ? multipleResults[index] : "Unknown",
  );
  const flattenedLabels = selectedLabels.flat();
  const labelCounts: Record<string, number> = {};
  flattenedLabels.forEach((label) => {
    labelCounts[label] = (labelCounts[label] || 0) + 1;
  });

  const data = Object.entries(labelCounts)
    .map(([label, count]) => ({
      label,
      count,
    }))
    .filter((d) => d.label !== "no_faces");

  const width = options.width ?? 400;
  const height = options.height ?? 300;
  const margin = { top: 20, right: 20, bottom: 50, left: 60 };

  const svg = d3.create("svg").attr("width", width).attr("height", height);

  const x = d3
    .scaleBand()
    .domain(data.map((d) => d.label))
    .range([margin.left, width - margin.right])
    .padding(0.1);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.count) ?? 0])
    .nice()
    .range([height - margin.bottom, margin.top]);

  svg
    .append("g")
    .selectAll("rect")
    .data(data)
    .join("rect")
    .attr("x", (d) => x(d.label)!)
    .attr("y", (d) => y(d.count))
    .attr("height", (d) => y(0) - y(d.count))
    .attr("width", x.bandwidth())
    .attr("fill", (_, i) => d3.schemeCategory10[i % 10]);

  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  return svg.node() as SVGSVGElement;
}

export function multipleDataPieChart(
  featureData: FeatureData,
  proxyTaskName: string,
  selected_points: number[],
  options: RenderFeatureDataOptions = {},
): SVGSVGElement {
  const multipleResults = featureData.multiple_results[proxyTaskName];
  if (!multipleResults) {
    throw new Error(
      `Proxy task "${proxyTaskName}" was not found in multiple results.`,
    );
  }

  const selectedLabels = selected_points.map((index) =>
    index < multipleResults.length ? multipleResults[index] : "Unknown",
  );
  const flattenedLabels = selectedLabels.flat();
  const labelCounts: Record<string, number> = {};
  flattenedLabels.forEach((label) => {
    labelCounts[label] = (labelCounts[label] || 0) + 1;
  });

  const data = Object.entries(labelCounts)
    .map(([label, count]) => ({
      label,
      count,
    }))
    .filter((d) => d.label !== "no_faces");

  const width = options.width ?? 400;
  const height = options.height ?? 300;
  const margin = { top: 20, right: 20, bottom: 50, left: 60 };

  const svg = d3.create("svg").attr("width", width).attr("height", height);

  const radius =
    Math.min(width, height) / 2 - Math.max(...Object.values(margin));

  const pie = d3.pie<{ label: string; count: number }>().value((d) => d.count);
  const arcs = pie(data);

  const arcGenerator = d3
    .arc<d3.PieArcDatum<{ label: string; count: number }>>()
    .innerRadius(0)
    .outerRadius(radius);
  const labelArcGenerator = d3
    .arc<d3.PieArcDatum<{ label: string; count: number }>>()
    .innerRadius(radius * 0.65)
    .outerRadius(radius * 0.65);

  const g = svg
    .append("g")
    .attr("transform", `translate(${width / 2},${height / 2})`);

  g.selectAll("path")
    .data(arcs)
    .join("path")
    .attr("d", arcGenerator)
    .attr("fill", (_, i) => d3.schemeCategory10[i % 10]);

  g.selectAll(".slice-label")
    .data(arcs)
    .join("text")
    .attr("class", "slice-label")
    .attr("transform", (d) => `translate(${labelArcGenerator.centroid(d)})`)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("fill", "#ffffff")
    .attr("font-size", 11)
    .text((d) => d.data.label);

  return svg.node() as SVGSVGElement;
}
