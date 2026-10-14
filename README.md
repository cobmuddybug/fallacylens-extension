# Fallacy Lens for Chrome

Select text on any page, right-click, and choose **Check for fallacies**. A card next to the selection
scores the text for 69 logical fallacies, using [Jev](https://openrouter.ai/typesafe) through OpenRouter:
the 24 on the *thou shalt not commit logical fallacies* poster, plus 45 more from the wider catalogues
(red herring, cherry picking, motte-and-bailey, sunk cost, affirming the consequent and others). The card leads with the fallacies that score
highest. Click one to see what it means, with an example.

Scores are Jev's estimate (0–100) that the text commits each fallacy, not a verdict.

## Install (from source)

1. Clone this repo.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and pick the repo folder.
3. The settings page opens. Paste an OpenRouter key (create one at <https://openrouter.ai/keys>; a
   dedicated key with a small credit limit is a good idea). A check costs a fraction of a cent.

Settings are always one click away on the toolbar icon.

## Privacy

Selected text is sent to OpenRouter and Jev's maker, TypeSafe, only when you choose
**Check for fallacies**. There is no analytics and no history. Your key is stored on your device in
the extension's own IndexedDB, which web pages and the extension's in-page card can't read, and is only
ever sent to OpenRouter. The score threshold is kept in `chrome.storage.local`.

## How scoring works

All 69 questions go to Jev in one request. Selections over 100,000 characters are split at paragraph
and sentence boundaries, with 600 characters of overlap. Each fallacy's score is its peak across the
parts, so the card says whether the selection *as a whole* contains it. The limit is 500,000 characters.

## Development

No dependencies; needs Node 22+ and, for e2e tests, Chromium.

    make test            # unit tests (offline, fake OpenRouter)
    make e2e             # headless Chromium against a fake OpenRouter (CHROMIUM=/path/to/chromium)
    FALLACYLENS_TEST_KEY=sk-or-… make live   # real Jev: sample texts + dilution probe, < $0.01
    make check-secrets   # run before every push
    make zip             # dist/fallacylens-extension-<version>.zip for the Chrome Web Store
    make fixtures        # regenerate chunking fixtures from the Fallacy Lens desktop app

## License

MIT
