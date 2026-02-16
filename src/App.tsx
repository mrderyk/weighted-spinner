import "./App.css";
import { WeightedWheel } from "./Spinner";

function App() {
  return (
    <>
      <WeightedWheel
        items={[
          { value: "apple", weight: 0 },
          { value: "banana", weight: 0 },
          { value: "cherry", weight: 0 },
          { value: "dragonfruit", weight: 0 },
          { value: "papaya", weight: 0 },
          { value: "mango", weight: 0 },
          { value: "strawberry", weight: 0 },
          { value: "lychee", weight: 0 },
          { value: "orange", weight: 0 },
          { value: "durian", weight: 100 },
          { value: "pear", weight: 0 },
        ]}
        onResult={(v) => console.log("Picked:", v)}
      />
    </>
  );
}

export default App;
