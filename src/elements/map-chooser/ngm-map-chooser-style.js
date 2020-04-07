import {css} from 'lit-element';

const style = css`
.ngm-maps-container {
  bottom: 30px;
  right: 10px;
  position: absolute;
  z-index: 10;
  display: flex;
}

img {
  padding: 0 5px;
  width: 96px;
  height: 64px;
}

label {
  position: absolute;
  background-color: white;
  padding: 0 5px;
  width: 96px;
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
