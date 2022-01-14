import {select} from 'd3-selection';
import {axisBottom, axisLeft} from 'd3-axis';
import {extent, max} from 'd3-array';
import {scaleLinear} from 'd3-scale';
import {area} from 'd3-shape';

/**
 *
 * @param data array of coords [x,y] respectively distance & elevation in meters
 * @param width
 * @param hight
 */
export function plotProfile(data: number[][], parentContainer = 'profile-plot') {
  const div = document.getElementById(parentContainer) as Element;
  const style = getComputedStyle(div);
  const width = div.clientWidth - parseInt(style.paddingLeft) - parseInt(style.paddingRight);
  const height = width / 6;

  // set the dimensions and margins of the graph
  const margin = {top: 10, right: 0, bottom: 40, left: 60};
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  // append the svg object
  const svg = select(`#${parentContainer}`).append('svg')
    .attr('width', w + margin.left + margin.right)
    .attr('height', h + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);


  // Add X axis
  const x = scaleLinear()
    .domain(extent(data, d => d[0] / 1000))
    .range([0, width]);
  svg.append('g')
    .attr('transform', `translate(0, ${h})`)
    .call(axisBottom(x));

  // Add Y axis
  const y = scaleLinear()
    .domain([0, max(data, d => d[1])])
    .range([h, 0]);
  svg.append('g')
    .call(axisLeft(y));

  // Add X axis label
  svg.append('text')
    .attr('text-anchor', 'end')
    .attr('x', w / 2 + margin.left)
    .attr('y', h + margin.top + 25)
    .text('Distance [km]');

  // Add Y axis label
  svg.append('text')
    .attr('text-anchor', 'end')
    .attr('transform', 'rotate(-90)')
    .attr('y', -margin.left + 15)
    .attr('x', -margin.top)
    .text('Elevation [m]');

  // Add the area
  svg.append('path')
    .datum(data)
    .attr('fill', '#B9271A')
    .attr('stroke', '#B9271A')
    .attr('stroke-width', 1.5)
    .attr('d', area()
      .x(d => x(d[0] / 1000))
      .y1(d => y(d[1]))
      .y0(y(0))
    );
}
