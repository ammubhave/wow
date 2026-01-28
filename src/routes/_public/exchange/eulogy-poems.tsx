import {createFileRoute} from "@tanstack/react-router";

import {Puzz, PuzzMain, PuzzFooter} from "./puzz-components";

export const Route = createFileRoute("/_public/exchange/eulogy-poems")({component: RouteComponent});

function RouteComponent() {
  return (
    <Puzz>
      <PuzzMain
        title="Eulogy Poems"
        flavor="Even the best / say farewell to / melt away. / Dearly departed / rest so we can mourn /
          once each shade is gone.">
        <audio src="/eulogy-poems-1.mp3" controls className="mb-4">
          Your browser does not support the audio element.
        </audio>
        <audio src="/eulogy-poems-2.mp3" controls className="mb-4">
          Your browser does not support the audio element.
        </audio>
        <audio src="/eulogy-poems-3.mp3" controls className="mb-4">
          Your browser does not support the audio element.
        </audio>
        <audio src="/eulogy-poems-4.mp3" controls className="mb-4">
          Your browser does not support the audio element.
        </audio>
        <audio src="/eulogy-poems-5.mp3" controls className="mb-4">
          Your browser does not support the audio element.
        </audio>
      </PuzzMain>
      <PuzzFooter answer="ICECREAMMANICURE" author="Kate">
        <></>
      </PuzzFooter>
    </Puzz>
  );
}
