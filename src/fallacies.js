// The 24 fallacies from the "thou shalt not commit logical fallacies" poster.
// definition: shown in the card. guidance: extra detail for Jev. example: shown in the card.
// Definitions and guidance come from the Fallacy Lens desktop app; the examples are original.

export const FALLACIES = [
  {
    id: "strawman", name: "Strawman",
    definition: "Misrepresenting someone's argument to make it easier to attack.",
    guidance: "The text restates an opposing position in a distorted, exaggerated or oversimplified form and then attacks that distorted version instead of the position actually held.",
    example: "Senator Lee wants a modest cut to the defense budget, so apparently she wants to leave the country defenseless.",
  },
  {
    id: "false_cause", name: "False cause",
    definition: "Presuming that a real or perceived relationship between things means one causes the other.",
    guidance: "The text infers causation from correlation, coincidence or mere sequence in time (post hoc) without justification.",
    example: "I started wearing my lucky socks and the team won three games straight, so the socks are clearly helping.",
  },
  {
    id: "appeal_to_emotion", name: "Appeal to emotion",
    definition: "Manipulating an emotional response in place of a valid or compelling argument.",
    guidance: "The text tries to win agreement by provoking pity, fear, guilt, outrage or similar feelings where reasons or evidence are needed.",
    example: "If you really loved your kids, you wouldn't even ask whether this expensive car seat is any safer.",
  },
  {
    id: "fallacy_fallacy", name: "The fallacy fallacy",
    definition: "Presuming that because a claim was poorly argued, or argued with a fallacy, it must be wrong.",
    guidance: "The text concludes a claim is false because someone defended it badly or committed a fallacy while arguing for it.",
    example: "Your case for recycling leaned on an appeal to emotion, so recycling obviously doesn't help.",
  },
  {
    id: "slippery_slope", name: "Slippery slope",
    definition: "Asserting that if we allow A, then Z will follow, therefore A should not happen.",
    guidance: "The text claims a modest first step will inevitably lead through a chain of events to an extreme outcome, without showing the chain is likely.",
    example: "If we let students redo one test, soon nobody will study for anything at all.",
  },
  {
    id: "ad_hominem", name: "Ad hominem",
    definition: "Attacking an opponent's character or personal traits to undermine their argument.",
    guidance: "The text dismisses an argument by attacking the person making it (character, history, motives, appearance) rather than the argument itself.",
    example: "Why listen to his views on tax policy? He's been divorced twice.",
  },
  {
    id: "tu_quoque", name: "Tu quoque",
    definition: "Avoiding criticism by turning it back on the accuser.",
    guidance: "The text answers a criticism by accusing the critic of the same or a similar fault (\"you do it too\") instead of addressing the criticism.",
    example: "You're telling me not to speed? I've watched you drive over the limit plenty of times.",
  },
  {
    id: "personal_incredulity", name: "Personal incredulity",
    definition: "Saying that because something is hard to understand or imagine, it must be untrue.",
    guidance: "The text rejects a claim mainly because the author finds it difficult to understand, unbelievable or counterintuitive.",
    example: "I can't see how something as heavy as a jumbo jet stays in the air, so the official explanation must be wrong.",
  },
  {
    id: "special_pleading", name: "Special pleading",
    definition: "Moving the goalposts or inventing an exception when a claim is shown to be false.",
    guidance: "The text exempts a favoured claim or case from a rule or standard applied elsewhere, or adds ad hoc excuses after the claim fails a test.",
    example: "My psychic powers failed the lab test only because the skeptics in the room gave off negative energy.",
  },
  {
    id: "loaded_question", name: "Loaded question",
    definition: "Asking a question with an unjustified assumption built in, so it can't be answered without appearing guilty.",
    guidance: "The text poses a question that presupposes something contentious or damaging (e.g. \"have you stopped cheating?\").",
    example: "Have you stopped wasting the company's money on pointless meetings yet?",
  },
  {
    id: "burden_of_proof", name: "Burden of proof",
    definition: "Saying the burden of proof lies with someone else to disprove a claim, not with the claimant.",
    guidance: "The text treats a claim as valid because nobody has disproved it, or demands that others disprove it rather than supporting it.",
    example: "Nobody has proven this house isn't haunted, so it's reasonable to believe it is.",
  },
  {
    id: "ambiguity", name: "Ambiguity",
    definition: "Using double meanings or ambiguous language to mislead or misrepresent the truth.",
    guidance: "The text relies on a word or phrase with more than one meaning, or on vague wording, shifting between senses (equivocation) to reach its conclusion or mislead.",
    example: "The sign said \"fine for parking here,\" so I took it to mean parking here was fine.",
  },
  {
    id: "gamblers_fallacy", name: "The gambler's fallacy",
    definition: "Believing that 'runs' occur in statistically independent events such as roulette spins.",
    guidance: "The text assumes past outcomes of independent random events change the odds of future ones (\"it's due\").",
    example: "The coin has landed heads six times in a row, so tails is bound to come up next.",
  },
  {
    id: "bandwagon", name: "Bandwagon",
    definition: "Appealing to popularity, or the fact that many people do something, as validation.",
    guidance: "The text argues a claim is true or a choice right because many or most people believe or do it.",
    example: "Millions of people swear by this diet, so it must be the healthiest way to eat.",
  },
  {
    id: "appeal_to_authority", name: "Appeal to authority",
    definition: "Using an authority's opinion or position in place of an actual argument.",
    guidance: "The text treats a claim as settled because an authority, expert, celebrity or institution endorses it, especially an authority outside their field, instead of giving reasons or evidence.",
    example: "A famous actor says this cryptocurrency is the future of money, so it's a safe investment.",
  },
  {
    id: "composition_division", name: "Composition / division",
    definition: "Assuming what's true of a part applies to the whole, or what's true of the whole applies to its parts.",
    guidance: "The text infers a property of a whole from its parts (composition) or of a part from the whole (division) where that inference does not hold.",
    example: "Every player on this team is an all-star, so the team is sure to be the best in the league.",
  },
  {
    id: "no_true_scotsman", name: "No true Scotsman",
    definition: "Appealing to purity to dismiss relevant criticisms or flaws of an argument.",
    guidance: "The text responds to a counterexample by redefining the group so the counterexample doesn't count (\"no real X would do that\").",
    example: "Dave left the game early? Then he's not a real fan, because no real fan would ever do that.",
  },
  {
    id: "genetic", name: "Genetic",
    definition: "Judging something good or bad on the basis of where, or whom, it comes from.",
    guidance: "The text accepts or rejects a claim because of its origin or source (a group, outlet, era, person) rather than its merits.",
    example: "That idea first appeared in a tabloid, so there's no point even considering it.",
  },
  {
    id: "black_or_white", name: "Black-or-white",
    definition: "Presenting two alternatives as the only possibilities when more exist.",
    guidance: "The text presents a false dilemma: only two options are offered, typically one clearly bad, while other reasonable options are ignored.",
    example: "Either you support every part of this bill, or you don't care about the environment.",
  },
  {
    id: "begging_the_question", name: "Begging the question",
    definition: "A circular argument in which the conclusion is included in the premise.",
    guidance: "The text's argument assumes its own conclusion: a premise restates or depends on the very thing being argued for.",
    example: "He's a reliable source, because everything he says is true.",
  },
  {
    id: "appeal_to_nature", name: "Appeal to nature",
    definition: "Arguing that because something is 'natural' it is valid, justified, good or ideal.",
    guidance: "The text argues something is good, safe or right because it is natural, or bad because it is unnatural or artificial.",
    example: "These wild berries are completely natural, so they can't possibly make you sick.",
  },
  {
    id: "anecdotal", name: "Anecdotal",
    definition: "Using personal experience or an isolated example instead of a valid argument.",
    guidance: "The text relies on a personal story or a single example as proof of a general claim, often to dismiss statistical or systematic evidence.",
    example: "My grandfather smoked a pack a day and lived to 95, so smoking can't be that bad for you.",
  },
  {
    id: "texas_sharpshooter", name: "The Texas sharpshooter",
    definition: "Cherry-picking data clusters to suit an argument, or finding a pattern to fit a presumption.",
    guidance: "The text selects only the data points that fit its conclusion, or draws a pattern around coincidental clusters after the fact, ignoring contrary data.",
    example: "Of all the towns along the power line, look at these five with high cancer rates: the line must be causing it.",
  },
  {
    id: "middle_ground", name: "Middle ground",
    definition: "Saying a compromise, or middle point, between two extremes must be the truth.",
    guidance: "The text concludes that the truth or right answer lies between two positions merely because it is a compromise between them.",
    example: "One engineer says the bridge is safe and another says it will collapse, so it's probably a little unsafe.",
  },
];

export const BY_ID = Object.fromEntries(FALLACIES.map(f => [f.id, f]));
