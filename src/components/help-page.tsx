export function HelpPage() {
  return (
    <div className="flex justify-center">
      <div className="flex max-w-4xl flex-1 flex-col gap-4 md:gap-8">
        <div className="mx-auto grid w-full max-w-6xl gap-2">
          <h1 className="text-3xl font-semibold">Help Page</h1>
        </div>
        <div className="mx-auto grid w-full max-w-6xl gap-2">
          <span className="font-bold">Swipe between pages</span>
          <div>
            To turn on/off swipe between pages on Chrome, visit
            chrome://settings/?search=swipe+between+pages to toggle the option.
          </div>
        </div>
      </div>
    </div>
  );
}
