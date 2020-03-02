const crossSectionBaseUrl = 'https://viewer.geomol.ch/webgui/createCrossSectionAsService.php';
const crossSectionParams = 'csRootElement=0&csRootScale=-1&depthRangeMax=3.40282e%2B38&depthRangeMin=-3.40282e%2B38&errorImageName=&geometryFileType=SFSP&intersectionGeometry=multilinestring%20z%20(({coordinates}))&legendTemplateFile=&outputType=PDF&overviewMap=&pointProjectionDistance=0&propertySelection=&secret=SAS2019@ngm&srs=18&subtreeRootElement=4660&templateFile=03-CS_swisstopo_Map_2019.svg&title={title}&user=NGM';

export function getCrossSectionUrl(coordinates, title = '') {
  return `${crossSectionBaseUrl}?${crossSectionParams}`
    .replace('{coordinates}', coordinates.map(coordinate => coordinate.join(' ')).join(','))
    .replace('{title}', title);
}

export function crossSection(coordinates, title = '') {

  return fetch(getCrossSectionUrl(coordinates, title))
    .then(response => response.json);
}
