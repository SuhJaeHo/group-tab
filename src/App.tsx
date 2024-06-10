import Board from "./components/Board";

function App() {
  return (
    <main className="size-full">
      <Board.Root>
        <Board.Container>
          <Board.Groups />
        </Board.Container>
      </Board.Root>
    </main>
  );
}

export default App;
