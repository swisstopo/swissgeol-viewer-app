import {css} from 'lit-element';

const style = css`
.ngm-maps-container {
  display: flex;
}

img {
  width: 64px;
  height: 64px;
}

label {
  font-size: 11px;
  position: absolute;
  background-color: white;
  width: 64px;
}

.ngm-map-preview {
  cursor: pointer;
  padding: 0 5px;
  background-color: white;
  text-align: center;
  margin-right: 4px;
  border: 1px solid lightgrey;
}

.ngm-map-preview:last-child {
  margin-right: 0;
}

.ngm-map-preview.active {
  border: 1px solid red;
  outline: 1px solid red;
}
`;

export default style;
