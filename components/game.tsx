import React, { useState } from "react";
import axios from "axios";
import { GameState } from "../types/game";
import { Item } from "../types/item";
import createState from "../lib/create-state";
import Board from "./board";
import Loading from "./loading";
import Instructions from "./instructions";
import badCards from "../lib/bad-cards";

/**
 * Mixes trivia and family cards into a deck, inserting one family card every `gap` trivia cards.
 * If family runs out, just serves trivia. If trivia runs out, continues with remaining family.
 */
function buildDeck(trivia: Item[], family: Item[], gap: number = 4): Item[] {
  const deck: Item[] = [];
  let triviaIdx = 0, familyIdx = 0;

  while (triviaIdx < trivia.length || familyIdx < family.length) {
    // Add up to `gap` trivia cards
    for (let i = 0; i < gap && triviaIdx < trivia.length; i++) {
      deck.push(trivia[triviaIdx++]);
    }
    // Add one family card if available
    if (familyIdx < family.length) {
      deck.push(family[familyIdx++]);
    }
  }
  return deck;
}

export default function Game() {
  const [state, setState] = useState<GameState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [started, setStarted] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);

  React.useEffect(() => {
    const fetchGameData = async () => {
      const res = await axios.get<string>("/items.json");
      const items: Item[] = res.data
        .trim()
        .split("\n")
        .map((line) => {
          return JSON.parse(line);
        })
        // Filter out questions which give away their answers
        .filter((item) => !item.label.includes(String(item.year)))
        .filter((item) => !item.description.includes(String(item.year)))
        .filter((item) => !/(?:th|st|nd)[ -]century/i.test(item.description))
        // Filter cards which have bad data as submitted in https://github.com/tom-james-watson/wikitrivia/discussions/2
        .filter((item) => !(item.id in badCards));
      setItems(items);
      const familyCards = items.filter(item => item.category === "family");
      const triviaCards = items.filter(item => item.category !== "family");
      const deck = buildDeck(triviaCards, familyCards, 4); // or whatever gap you prefer
      setItems(deck);
    };

    fetchGameData();
  }, []);

  React.useEffect(() => {
    (async () => {
      if (items !== null) {
        setState(await createState(items));
        setLoaded(true);
      }
    })();
  }, [items]);

  const resetGame = React.useCallback(() => {
    (async () => {
      if (items !== null) {
        setState(await createState(items));
      }
    })();
  }, [items]);

  const [highscore, setHighscore] = React.useState<number>(
    Number(localStorage.getItem("highscore") ?? "0")
  );

  const updateHighscore = React.useCallback((score: number) => {
    localStorage.setItem("highscore", String(score));
    setHighscore(score);
  }, []);

  if (!loaded || state === null) {
    return <Loading />;
  }

  if (!started) {
    return (
      <Instructions highscore={highscore} start={() => setStarted(true)} />
    );
  }

  return (
    <Board
      highscore={highscore}
      state={state}
      setState={setState}
      resetGame={resetGame}
      updateHighscore={updateHighscore}
    />
  );
}
