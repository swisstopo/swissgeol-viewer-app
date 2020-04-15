import {css} from 'lit-element';

const style = css`
.ngm-maps-container {
  display: flex;
}

img {
  padding: 0 5px;
  width: 64px;
  height: 64px;
}

label {
  font-size: 11px;
  position: absolute;
  background-color: white;
  padding: 0 5px;
  width: 64px;
}

.ngm-map-preview {
  background-color: white;
  text-align: center;
  margin-right: 4px;
  border: 1px solid lightgrey;
}

.ngm-map-preview.active {
  border: 2px solid red;
}
`;

export default style;
