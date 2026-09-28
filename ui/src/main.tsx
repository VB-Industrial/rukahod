import { render } from "preact";

import { App } from "./app/App";
import "./styles/app.css";
import "./styles/rover.css";
import "./styles/unified.css";

render(<App />, document.getElementById("app")!);
