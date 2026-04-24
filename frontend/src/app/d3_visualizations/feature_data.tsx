import * as d3 from "d3";

export type FeaturePoint = [number, number];

export type FeatureData = {
  features: Record<string, FeaturePoint[]>;
  proxy_tasks_names: string[];
  classification_results: Record<string, string[]>;
  multiple_results: Record<string, string[][]>;
};

export type RenderFeatureDataOptions = {
  width?: number;
  height?: number;
  pointRadius?: number;
};

export function renderFeatureData(
  featureData: FeatureData,
  proxyTaskName: string,
  images: FileList,
  colorByProxyTaskName?: string,
  options: RenderFeatureDataOptions = {},
): SVGSVGElement {
  const points = featureData.features[proxyTaskName];
  if (!points) {
    throw new Error(
      `Proxy task "${proxyTaskName}" was not found in features data.`,
    );
  }

  const pointData = points
    .map(([x, y], index) => ({ x, y, index }))
    .filter(({ x, y }) => Number.isFinite(x) && Number.isFinite(y));
  if (pointData.length === 0) {
    throw new Error(
      `Proxy task "${proxyTaskName}" does not contain valid points.`,
    );
  }

  const colorByValues = colorByProxyTaskName
    ? featureData.classification_results[colorByProxyTaskName]
    : undefined;
  const labels = colorByValues
    ? pointData.map(({ index }) =>
        index < colorByValues.length
          ? String(colorByValues[index])
          : "Unknown Coloring",
      )
    : [];
  const labelDomain = Array.from(new Set(labels));

  const width = options.width ?? 720;
  const height = options.height ?? 480;
  const pointRadius = options.pointRadius ?? 3.5;
  const margin = {
    top: 24,
    right: labelDomain.length > 0 ? 180 : 24,
    bottom: 44,
    left: 52,
  };

  const xExtent = d3.extent(pointData, ({ x }) => x) as [number, number];
  const yExtent = d3.extent(pointData, ({ y }) => y) as [number, number];

  const xScale = d3
    .scaleLinear()
    .domain(xExtent)
    .nice()
    .range([margin.left, width - margin.right]);

  const yScale = d3
    .scaleLinear()
    .domain(yExtent)
    .nice()
    .range([height - margin.bottom, margin.top]);

  const colorScale = d3
    .scaleOrdinal<string, string>()
    .domain(labelDomain)
    .range(d3.schemeTableau10);

  const imageFiles = Array.from(images).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const imageDataUrlCache = new Map<number, string>();

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () =>
        reject(
          new Error(
            `Failed to read image "${file.name}" for feature tooltip preview.`,
          ),
        );
      reader.readAsDataURL(file);
    });

  const svg = d3
    .create("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", `${proxyTaskName} feature scatter plot`);

  const tooltipWidth = 140;
  const tooltipHeight = 140;
  const tooltipPadding = 8;
  const tooltip = svg
    .append("g")
    .attr("pointer-events", "none")
    .style("visibility", "hidden");

  tooltip
    .append("rect")
    .attr("width", tooltipWidth)
    .attr("height", tooltipHeight + 20)
    .attr("rx", 6)
    .attr("fill", "#ffffff")
    .attr("stroke", "#d4d4d8")
    .attr("opacity", 0.95);

  const tooltipImage = tooltip
    .append("image")
    .attr("x", tooltipPadding)
    .attr("y", tooltipPadding)
    .attr("width", tooltipWidth - tooltipPadding * 2)
    .attr("height", tooltipHeight - tooltipPadding * 2)
    .attr("preserveAspectRatio", "xMidYMid slice");

  const tooltipText = tooltip
    .append("text")
    .attr("x", tooltipPadding)
    .attr("y", tooltipHeight + 12)
    .attr("font-size", 10)
    .attr("fill", "#ffffff");

  const setTooltipPosition = (event: MouseEvent) => {
    const [mx, my] = d3.pointer(event, svg.node());
    const maxX = width - tooltipWidth - 4;
    const maxY = height - (tooltipHeight + 20) - 4;
    const x = Math.max(4, Math.min(mx + 12, maxX));
    const y = Math.max(4, Math.min(my - (tooltipHeight + 28), maxY));
    tooltip.attr("transform", `translate(${x},${y})`);
  };

  const plotLayer = svg.append("g").attr("class", "plot-layer");
  const brushLayer = plotLayer.append("g").attr("class", "brush-layer");
  const pointsLayer = plotLayer.append("g").attr("class", "points-layer");

  plotLayer
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(xScale));

  plotLayer
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(yScale));

  const circles = pointsLayer
    .selectAll("circle")
    .data(pointData)
    .join("circle")
    .attr("cx", ({ x }) => xScale(x))
    .attr("cy", ({ y }) => yScale(y))
    .attr("r", pointRadius)
    .attr("fill", ({ index }) => {
      if (!labelDomain.length) {
        return "#2563eb";
      }

      const label =
        colorByValues && index < colorByValues.length
          ? String(colorByValues[index])
          : "Unknown Coloring";
      return colorScale(label);
    })
    .attr("fill-opacity", 0.75)
    .attr("data-brushed", "false")
    .on("mouseenter", async function (event, { index }) {
      const imageFile = imageFiles[index];
      if (!imageFile) {
        return;
      }

      let dataUrl = imageDataUrlCache.get(index);
      if (!dataUrl) {
        try {
          dataUrl = await readFileAsDataUrl(imageFile);
          imageDataUrlCache.set(index, dataUrl);
        } catch {
          return;
        }
      }

      d3.select(this).attr("stroke", "#ffffff").attr("stroke-width", 1.2);
      tooltipImage.attr("href", dataUrl);
      tooltipText.text(imageFile.name);
      setTooltipPosition(event);
      tooltip.raise().style("visibility", "visible");
    })
    .on("mousemove", (event) => {
      setTooltipPosition(event);
      tooltip.raise();
    })
    .on("mouseleave", function () {
      const circle = d3.select(this);
      if (circle.attr("data-brushed") === "true") {
        circle.attr("stroke", "#ffffff").attr("stroke-width", 1.5);
      } else {
        circle.attr("stroke", null).attr("stroke-width", null);
      }
      tooltip.style("visibility", "hidden");
    });

  const brush = d3
    .brush<undefined>()
    .extent([
      [margin.left, margin.top],
      [width - margin.right, height - margin.bottom],
    ])
    .on("brush end", (event) => {
      const selection = event.selection as
        | [[number, number], [number, number]]
        | null;

      if (!selection) {
        circles
          .attr("data-brushed", "false")
          .attr("stroke", null)
          .attr("stroke-width", null)
          .attr("fill-opacity", 0.75);
        svg
          .node()
          ?.dispatchEvent(new CustomEvent("points-brushed", { detail: [] }));
        return;
      }

      const [[x0, y0], [x1, y1]] = selection;
      const selectedIndices: number[] = [];
      circles.each(function ({ x, y, index }) {
        const cx = xScale(x);
        const cy = yScale(y);
        const isSelected = x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
        if (isSelected) {
          selectedIndices.push(index);
        }

        d3.select(this)
          .attr("data-brushed", isSelected ? "true" : "false")
          .attr("stroke", isSelected ? "#ffffff" : null)
          .attr("stroke-width", isSelected ? 1.5 : null)
          .attr("fill-opacity", isSelected ? 1 : 0.2);
      });

      svg
        .node()
        ?.dispatchEvent(
          new CustomEvent("points-brushed", { detail: selectedIndices }),
        );
    });

  brushLayer.call(brush);

  if (labelDomain.length > 0) {
    const legend = svg
      .append("g")
      .attr(
        "transform",
        `translate(${width - margin.right + 12},${margin.top})`,
      );

    legend
      .append("text")
      .attr("x", 0)
      .attr("y", 0)
      .attr("font-size", 12)
      .attr("font-weight", 600)
      .attr("fill", "#ffffff")
      .text(colorByProxyTaskName ?? "Label");

    const legendItems = legend
      .selectAll("g")
      .data(labelDomain)
      .join("g")
      .attr("transform", (_, i) => `translate(0, ${18 + i * 18})`);

    legendItems
      .append("circle")
      .attr("r", 5)
      .attr("cx", 5)
      .attr("cy", 0)
      .attr("fill", (label) => colorScale(label));

    legendItems
      .append("text")
      .attr("x", 16)
      .attr("y", 4)
      .attr("font-size", 12)
      .attr("fill", "#ffffff")
      .text((label) => label);
  }

  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", margin.top - 6)
    .attr("text-anchor", "middle")
    .attr("font-size", 14)
    .attr("font-weight", 600)
    .attr("fill", "#ffffff")
    .text(`${proxyTaskName} Scatter Plot`);

  return svg.node() as SVGSVGElement;
}

export function renderSelectedFeatureData(
  featureData: FeatureData,
  proxyTaskName: string,
  selectedPointIndices: number[],
  options: RenderFeatureDataOptions = {},
): SVGSVGElement {
  const points = featureData.features[proxyTaskName];
  if (!points) {
    throw new Error(
      `Proxy task "${proxyTaskName}" was not found in features data.`,
    );
  }

  const pointData = points
    .map(([x, y], index) => ({ x, y, index }))
    .filter(({ x, y }) => Number.isFinite(x) && Number.isFinite(y));
  if (pointData.length === 0) {
    throw new Error(
      `Proxy task "${proxyTaskName}" does not contain valid points.`,
    );
  }

  const width = options.width ?? 720;
  const height = options.height ?? 480;
  const pointRadius = options.pointRadius ?? 3.5;
  const margin = {
    top: 24,
    right: 24,
    bottom: 44,
    left: 52,
  };

  const xExtent = d3.extent(pointData, ({ x }) => x) as [number, number];
  const yExtent = d3.extent(pointData, ({ y }) => y) as [number, number];

  const xScale = d3
    .scaleLinear()
    .domain(xExtent)
    .nice()
    .range([margin.left, width - margin.right]);

  const yScale = d3
    .scaleLinear()
    .domain(yExtent)
    .nice()
    .range([height - margin.bottom, margin.top]);

  const selectedIndices = new Set(selectedPointIndices);
  const hasSelection = selectedIndices.size > 0;

  const svg = d3
    .create("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", `${proxyTaskName} feature scatter plot`);

  const plotLayer = svg.append("g").attr("class", "plot-layer");
  const pointsLayer = plotLayer.append("g").attr("class", "points-layer");

  plotLayer
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(xScale));

  plotLayer
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(yScale));

  pointsLayer
    .selectAll("circle")
    .data(pointData)
    .join("circle")
    .attr("cx", ({ x }) => xScale(x))
    .attr("cy", ({ y }) => yScale(y))
    .attr("r", pointRadius)
    .attr("fill", ({ index }) =>
      selectedIndices.has(index) ? "#f59e0b" : "#2563eb",
    )
    .attr("fill-opacity", ({ index }) =>
      !hasSelection || selectedIndices.has(index) ? 0.9 : 0.4,
    )
    .attr("stroke", ({ index }) =>
      selectedIndices.has(index) ? "#ffffff" : null,
    )
    .attr("stroke-width", ({ index }) =>
      selectedIndices.has(index) ? 1.5 : null,
    );

  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", margin.top - 6)
    .attr("text-anchor", "middle")
    .attr("font-size", 14)
    .attr("font-weight", 600)
    .attr("fill", "#ffffff")
    .text(`${proxyTaskName} Scatter Plot (Selected Points)`);

  return svg.node() as SVGSVGElement;
}
