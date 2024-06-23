import Board from "./components/Board";

function App() {
  return (
    <main className="size-full grid grid-rows-[auto_1fr_auto]">
      <div className="h-[30px] w-full bg-gray-500" />
      <Board.Root>
        <Board.Container>
          <Board.Groups />
        </Board.Container>
      </Board.Root>
      <div className="h-[30px] w-full bg-gray-500" />
    </main>
  );
}

export default App;
