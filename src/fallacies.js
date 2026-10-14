// 69 fallacies: first the 24 from the "thou shalt not commit logical fallacies" poster, then 45 more.
// definition: shown in the card. guidance: extra detail for Jev. example: shown in the card.
// group: shown in the card's detail. For the poster's 24, definitions and guidance come from the
// Fallacy Lens desktop app and the examples are original.

export const FALLACIES = [
  {
    id: "strawman", name: "Strawman", group: "Relevance",
    definition: "Misrepresenting someone's argument to make it easier to attack.",
    guidance: "The text restates an opposing position in a distorted, exaggerated or oversimplified form and then attacks that distorted version instead of the position actually held.",
    example: "Senator Lee wants a modest cut to the defense budget, so apparently she wants to leave the country defenseless.",
  },
  {
    id: "false_cause", name: "False cause", group: "Cause and statistics",
    definition: "Presuming that a real or perceived relationship between things means one causes the other.",
    guidance: "The text infers causation from correlation, coincidence or mere sequence in time (post hoc) without justification.",
    example: "I started wearing my lucky socks and the team won three games straight, so the socks are clearly helping.",
  },
  {
    id: "appeal_to_emotion", name: "Appeal to emotion", group: "Relevance",
    definition: "Manipulating an emotional response in place of a valid or compelling argument.",
    guidance: "The text tries to win agreement by provoking pity, fear, guilt, outrage or similar feelings where reasons or evidence are needed.",
    example: "If you really loved your kids, you wouldn't even ask whether this expensive car seat is any safer.",
  },
  {
    id: "fallacy_fallacy", name: "The fallacy fallacy", group: "Argument structure",
    definition: "Presuming that because a claim was poorly argued, or argued with a fallacy, it must be wrong.",
    guidance: "The text concludes a claim is false because someone defended it badly or committed a fallacy while arguing for it.",
    example: "Your case for recycling leaned on an appeal to emotion, so recycling obviously doesn't help.",
  },
  {
    id: "slippery_slope", name: "Slippery slope", group: "Cause and statistics",
    definition: "Asserting that if we allow A, then Z will follow, therefore A should not happen.",
    guidance: "The text claims a modest first step will inevitably lead through a chain of events to an extreme outcome, without showing the chain is likely.",
    example: "If we let students redo one test, soon nobody will study for anything at all.",
  },
  {
    id: "ad_hominem", name: "Ad hominem", group: "Relevance",
    definition: "Attacking an opponent's character or personal traits to undermine their argument.",
    guidance: "The text dismisses an argument by attacking the person making it (character, history, motives, appearance) rather than the argument itself.",
    example: "Why listen to his views on tax policy? He's been divorced twice.",
  },
  {
    id: "tu_quoque", name: "Tu quoque", group: "Relevance",
    definition: "Avoiding criticism by turning it back on the accuser.",
    guidance: "The text answers a criticism by accusing the critic of the same or a similar fault (\"you do it too\") instead of addressing the criticism.",
    example: "You're telling me not to speed? I've watched you drive over the limit plenty of times.",
  },
  {
    id: "personal_incredulity", name: "Personal incredulity", group: "Relevance",
    definition: "Saying that because something is hard to understand or imagine, it must be untrue.",
    guidance: "The text rejects a claim mainly because the author finds it difficult to understand, unbelievable or counterintuitive.",
    example: "I can't see how something as heavy as a jumbo jet stays in the air, so the official explanation must be wrong.",
  },
  {
    id: "special_pleading", name: "Special pleading", group: "Argument structure",
    definition: "Moving the goalposts or inventing an exception when a claim is shown to be false.",
    guidance: "The text exempts a favoured claim or case from a rule or standard applied elsewhere, or adds ad hoc excuses after the claim fails a test.",
    example: "My psychic powers failed the lab test only because the skeptics in the room gave off negative energy.",
  },
  {
    id: "loaded_question", name: "Loaded question", group: "Argument structure",
    definition: "Asking a question with an unjustified assumption built in, so it can't be answered without appearing guilty.",
    guidance: "The text poses a question that presupposes something contentious or damaging (e.g. \"have you stopped cheating?\").",
    example: "Have you stopped wasting the company's money on pointless meetings yet?",
  },
  {
    id: "burden_of_proof", name: "Burden of proof", group: "Argument structure",
    definition: "Saying the burden of proof lies with someone else to disprove a claim, not with the claimant.",
    guidance: "The text treats a claim as valid because nobody has disproved it, or demands that others disprove it rather than supporting it.",
    example: "Nobody has proven this house isn't haunted, so it's reasonable to believe it is.",
  },
  {
    id: "ambiguity", name: "Ambiguity", group: "Language",
    definition: "Using double meanings or ambiguous language to mislead or misrepresent the truth.",
    guidance: "The text relies on a word or phrase with more than one meaning, or on vague wording, shifting between senses (equivocation) to reach its conclusion or mislead.",
    example: "The sign said \"fine for parking here,\" so I took it to mean parking here was fine.",
  },
  {
    id: "gamblers_fallacy", name: "The gambler's fallacy", group: "Cause and statistics",
    definition: "Believing that 'runs' occur in statistically independent events such as roulette spins.",
    guidance: "The text assumes past outcomes of independent random events change the odds of future ones (\"it's due\").",
    example: "The coin has landed heads six times in a row, so tails is bound to come up next.",
  },
  {
    id: "bandwagon", name: "Bandwagon", group: "Relevance",
    definition: "Appealing to popularity, or the fact that many people do something, as validation.",
    guidance: "The text argues a claim is true or a choice right because many or most people believe or do it.",
    example: "Millions of people swear by this diet, so it must be the healthiest way to eat.",
  },
  {
    id: "appeal_to_authority", name: "Appeal to authority", group: "Relevance",
    definition: "Using an authority's opinion or position in place of an actual argument.",
    guidance: "The text treats a claim as settled because an authority, expert, celebrity or institution endorses it, especially an authority outside their field, instead of giving reasons or evidence.",
    example: "A famous actor says this cryptocurrency is the future of money, so it's a safe investment.",
  },
  {
    id: "composition_division", name: "Composition / division", group: "Generalisation",
    definition: "Assuming what's true of a part applies to the whole, or what's true of the whole applies to its parts.",
    guidance: "The text infers a property of a whole from its parts (composition) or of a part from the whole (division) where that inference does not hold.",
    example: "Every player on this team is an all-star, so the team is sure to be the best in the league.",
  },
  {
    id: "no_true_scotsman", name: "No true Scotsman", group: "Generalisation",
    definition: "Appealing to purity to dismiss relevant criticisms or flaws of an argument.",
    guidance: "The text responds to a counterexample by redefining the group so the counterexample doesn't count (\"no real X would do that\").",
    example: "Dave left the game early? Then he's not a real fan, because no real fan would ever do that.",
  },
  {
    id: "genetic", name: "Genetic", group: "Relevance",
    definition: "Judging something good or bad on the basis of where, or whom, it comes from.",
    guidance: "The text accepts or rejects a claim because of its origin or source (a group, outlet, era, person) rather than its merits.",
    example: "That idea first appeared in a tabloid, so there's no point even considering it.",
  },
  {
    id: "black_or_white", name: "Black-or-white", group: "Argument structure",
    definition: "Presenting two alternatives as the only possibilities when more exist.",
    guidance: "The text presents a false dilemma: only two options are offered, typically one clearly bad, while other reasonable options are ignored.",
    example: "Either you support every part of this bill, or you don't care about the environment.",
  },
  {
    id: "begging_the_question", name: "Begging the question", group: "Argument structure",
    definition: "A circular argument in which the conclusion is included in the premise.",
    guidance: "The text's argument assumes its own conclusion: a premise restates or depends on the very thing being argued for.",
    example: "He's a reliable source, because everything he says is true.",
  },
  {
    id: "appeal_to_nature", name: "Appeal to nature", group: "Relevance",
    definition: "Arguing that because something is 'natural' it is valid, justified, good or ideal.",
    guidance: "The text argues something is good, safe or right because it is natural, or bad because it is unnatural or artificial.",
    example: "These wild berries are completely natural, so they can't possibly make you sick.",
  },
  {
    id: "anecdotal", name: "Anecdotal", group: "Generalisation",
    definition: "Using personal experience or an isolated example instead of a valid argument.",
    guidance: "The text relies on a personal story or a single example as proof of a general claim, often to dismiss statistical or systematic evidence.",
    example: "My grandfather smoked a pack a day and lived to 95, so smoking can't be that bad for you.",
  },
  {
    id: "texas_sharpshooter", name: "The Texas sharpshooter", group: "Cause and statistics",
    definition: "Cherry-picking data clusters to suit an argument, or finding a pattern to fit a presumption.",
    guidance: "The text selects only the data points that fit its conclusion, or draws a pattern around coincidental clusters after the fact, ignoring contrary data.",
    example: "Of all the towns along the power line, look at these five with high cancer rates: the line must be causing it.",
  },
  {
    id: "middle_ground", name: "Middle ground", group: "Argument structure",
    definition: "Saying a compromise, or middle point, between two extremes must be the truth.",
    guidance: "The text concludes that the truth or right answer lies between two positions merely because it is a compromise between them.",
    example: "One engineer says the bridge is safe and another says it will collapse, so it's probably a little unsafe.",
  },
  // The rest are drawn from the wider catalogues of informal fallacies (Wikipedia's list of fallacies,
  // the Internet Encyclopedia of Philosophy, the Fallacy Files). Definitions, guidance and examples are original.

  // Relevance
  {
    id: "red_herring", name: "Red herring", group: "Relevance",
    definition: "Bringing in an irrelevant topic to divert attention from the issue at hand.",
    guidance: "The text responds to a question or criticism by shifting to a different subject that does not bear on it, and treats the original point as settled or forgotten.",
    example: "Asked why the budget overran, the mayor said the real story is how much the new park has improved the neighbourhood.",
  },
  {
    id: "poisoning_the_well", name: "Poisoning the well", group: "Relevance",
    definition: "Discrediting a source in advance so that anything it says will be dismissed.",
    guidance: "Before or instead of engaging with what someone will say, the text presents unfavourable information about them so the audience rejects their claims before hearing them.",
    example: "Before you listen to my opponent, remember that he'll say anything to get elected.",
  },
  {
    id: "appeal_to_motive", name: "Appeal to motive", group: "Relevance",
    definition: "Dismissing a claim by questioning the motives of the person making it.",
    guidance: "The text rejects an argument because the arguer supposedly has an interest, bias or hidden reason for holding it (circumstantial ad hominem, Bulverism), without showing the argument itself is wrong.",
    example: "Of course the dentist says sugar rots your teeth; she makes her living fixing cavities.",
  },
  {
    id: "guilt_by_association", name: "Guilt by association", group: "Relevance",
    definition: "Discrediting an idea or person because of who else holds it or is linked to them.",
    guidance: "The text argues a claim, policy or person is bad because it is associated with, endorsed by or resembles a disliked group or individual, rather than on its merits.",
    example: "Dictators have built big highways too, so the senator's road plan is clearly authoritarian.",
  },
  {
    id: "appeal_to_fear", name: "Appeal to fear", group: "Relevance",
    definition: "Winning agreement by stoking fear instead of giving evidence.",
    guidance: "The text pushes a conclusion by vividly invoking danger or frightening consequences that are exaggerated, unsupported or not connected to the merits of the claim.",
    example: "If you don't buy our alarm system tonight, your family could be the next one on the evening news.",
  },
  {
    id: "appeal_to_pity", name: "Appeal to pity", group: "Relevance",
    definition: "Seeking agreement by evoking sympathy rather than giving reasons.",
    guidance: "The text argues a claim should be accepted, or a judgement changed, because of someone's hardship or suffering when that hardship is irrelevant to the question.",
    example: "I deserve an A on this essay; I stayed up all night and my cat has been sick all week.",
  },
  {
    id: "appeal_to_ridicule", name: "Appeal to ridicule", group: "Relevance",
    definition: "Mocking a claim to make it look absurd instead of showing that it is wrong.",
    guidance: "The text treats a position as refuted by presenting it in a laughable way, using sarcasm, jokes or scorn, rather than giving reasons against it. Dismissing a claim as obviously absurd without argument also counts.",
    example: "Solar power for the whole city? Sure, and maybe we can run the buses on rainbows too.",
  },
  {
    id: "appeal_to_flattery", name: "Appeal to flattery", group: "Relevance",
    definition: "Using compliments to win agreement in place of an argument.",
    guidance: "The text tries to get the reader to accept a claim by praising them, implying that smart, discerning or good people will naturally agree.",
    example: "A reader as sharp as you can surely see that this investment is a sure thing.",
  },
  {
    id: "appeal_to_force", name: "Appeal to force", group: "Relevance",
    definition: "Using threats or intimidation to make someone accept a conclusion.",
    guidance: "The text urges acceptance of a claim through a threat of harm, punishment or loss (argumentum ad baculum) rather than through reasons that the claim is true.",
    example: "You'll agree the new schedule is fair if you want to keep your job here.",
  },
  {
    id: "appeal_to_consequences", name: "Appeal to consequences", group: "Relevance",
    definition: "Arguing a belief is true or false because of whether its consequences would be good or bad.",
    guidance: "The text claims something is true because believing it would be pleasant or useful, or false because accepting it would be unpleasant, rather than on the evidence for it.",
    example: "Climate change can't be that serious, because if it were, we'd have to change the way we live.",
  },
  {
    id: "appeal_to_tradition", name: "Appeal to tradition", group: "Relevance",
    definition: "Saying something is right or good because it has always been done that way.",
    guidance: "The text treats the age, history or customary status of a practice or belief as enough to show it is correct or should continue.",
    example: "We've graded on a curve at this school for fifty years, so it must be the fairest system.",
  },
  {
    id: "appeal_to_novelty", name: "Appeal to novelty", group: "Relevance",
    definition: "Saying something is better or correct simply because it is new.",
    guidance: "The text treats newness, modernity or being the latest version as enough reason to think something is superior or true.",
    example: "This diet only came out last month, so it's bound to work better than the old advice.",
  },
  {
    id: "two_wrongs", name: "Two wrongs make a right", group: "Relevance",
    definition: "Justifying a wrong act because someone else did something similar or worse.",
    guidance: "The text argues that a harmful or wrong action is acceptable because it answers, matches or is less bad than another wrong.",
    example: "They cheated on their taxes, so it's only fair that I cheat on mine.",
  },
  {
    id: "relative_privation", name: "Relative privation", group: "Relevance",
    definition: "Dismissing a problem because worse problems exist.",
    guidance: "The text argues an issue doesn't matter or shouldn't be addressed because there are more serious problems elsewhere (\"not as bad as\", \"people are starving\").",
    example: "Why complain about the potholes on your street when some countries don't even have roads?",
  },
  {
    id: "tone_policing", name: "Tone policing", group: "Relevance",
    definition: "Dismissing an argument because of the emotion or manner in which it is expressed.",
    guidance: "The text rejects or refuses to engage with a claim because the speaker is angry, upset, rude or emotional, rather than addressing its content.",
    example: "I'm not going to consider your complaint about the layoffs while you're this upset about them.",
  },
  {
    id: "argument_from_repetition", name: "Argument from repetition", group: "Relevance",
    definition: "Repeating a claim over and over as if repetition made it true.",
    guidance: "The text asserts the same claim many times, or points to how often it has been said, in place of supporting it (ad nauseam).",
    example: "The election was stolen. Everyone knows it was stolen. I'll say it again: it was stolen.",
  },
  {
    id: "appeal_to_ignorance", name: "Appeal to ignorance", group: "Relevance",
    definition: "Claiming something is true because it hasn't been proven false, or false because it hasn't been proven true.",
    guidance: "The text treats a lack of evidence or disproof as evidence for the opposite conclusion (argumentum ad ignorantiam).",
    example: "No one has ever proven that ghosts don't exist, so they must be real.",
  },
  {
    id: "thought_terminating_cliche", name: "Thought-terminating cliché", group: "Relevance",
    definition: "Using a stock phrase to shut down thought or debate instead of answering it.",
    guidance: "The text ends or dodges discussion of a point with a catchphrase or platitude (\"it is what it is\", \"everything happens for a reason\", \"boys will be boys\") that offers no reason.",
    example: "Sure, the factory polluted the river, but business is business, so let's move on.",
  },
  {
    id: "is_ought", name: "Is–ought fallacy", group: "Relevance",
    definition: "Concluding what ought to be purely from what is.",
    guidance: "The text moves from a factual claim about how things are, or how they usually are, straight to a claim about how they should be, without a moral premise to bridge the gap.",
    example: "People have always formed hierarchies, so a society with equal power for everyone would be wrong.",
  },
  {
    id: "wishful_thinking", name: "Wishful thinking", group: "Relevance",
    definition: "Believing something because you want it to be true.",
    guidance: "The text reaches or holds a conclusion because it is hoped for, comforting or desirable, rather than because the evidence supports it.",
    example: "I really need this startup to succeed, so I'm sure the investors will come through.",
  },

  // Generalisation
  {
    id: "hasty_generalization", name: "Hasty generalisation", group: "Generalisation",
    definition: "Drawing a broad conclusion from too small or unrepresentative a sample.",
    guidance: "The text generalises about a whole group, category or pattern from a few cases, a brief experience or a biased sample.",
    example: "My two neighbours from that city were rude, so people from there must be unfriendly.",
  },
  {
    id: "cherry_picking", name: "Cherry picking", group: "Generalisation",
    definition: "Presenting only the evidence that supports a claim and ignoring the evidence against it.",
    guidance: "The text supports a conclusion by citing favourable studies, quotes, data or examples while omitting or ignoring readily available evidence that points the other way.",
    example: "The brochure quotes the three glowing reviews and leaves out the forty complaints.",
  },
  {
    id: "nut_picking", name: "Nut-picking", group: "Generalisation",
    definition: "Treating the most extreme members of a group as representative of the whole.",
    guidance: "The text characterises a group, movement or side by its least reasonable or most outrageous members and implies they represent everyone in it.",
    example: "One protester online said all cars should be banned, which shows what cyclists really want.",
  },
  {
    id: "survivorship_bias", name: "Survivorship bias", group: "Generalisation",
    definition: "Drawing conclusions only from the cases that made it through a selection process, ignoring the ones that didn't.",
    guidance: "The text generalises from successes, survivors or visible cases while overlooking the failures that were filtered out and would change the conclusion.",
    example: "Lots of billionaires dropped out of college, so dropping out is a smart path to success.",
  },
  {
    id: "false_analogy", name: "False analogy", group: "Generalisation",
    definition: "Arguing that because two things are alike in some ways, they must be alike in another.",
    guidance: "The text bases its conclusion on a comparison between things whose relevant differences undermine it, or whose similarities do not bear on the point.",
    example: "Employees are like nails: just as nails must be hit to work, workers must be pushed hard.",
  },
  {
    id: "accident", name: "Accident", group: "Generalisation",
    definition: "Applying a general rule to a case where it clearly doesn't fit.",
    guidance: "The text applies a rule of thumb or generalisation rigidly to an exceptional case, ignoring circumstances that make the rule inapplicable (dicto simpliciter).",
    example: "Lying is wrong, so you shouldn't have told the burglar your family wasn't home.",
  },

  // Cause and statistics
  {
    id: "single_cause", name: "Single cause", group: "Cause and statistics",
    definition: "Assuming a complex outcome has one simple cause when it has several.",
    guidance: "The text attributes an outcome produced by many interacting factors to a single cause, and treats addressing that one cause as sufficient.",
    example: "Crime went up because of violent video games, and that's all there is to it.",
  },
  {
    id: "sunk_cost", name: "Sunk cost", group: "Cause and statistics",
    definition: "Continuing with something because of what has already been invested in it, not because of its future value.",
    guidance: "The text argues for persisting with a plan, purchase or project because of time, money or effort already spent and unrecoverable, rather than on prospective costs and benefits.",
    example: "We've already spent two million on this failing software, so we can't stop now.",
  },
  {
    id: "base_rate_neglect", name: "Base-rate neglect", group: "Cause and statistics",
    definition: "Ignoring how common something is in general when judging a specific case.",
    guidance: "The text draws a probability conclusion from specific evidence (a test result, a profile, a match) while ignoring the underlying frequency of the condition or group, which would change the answer (includes the prosecutor's fallacy).",
    example: "The test is 99% accurate and you tested positive, so you almost certainly have this one-in-a-million disease.",
  },

  // Language
  {
    id: "motte_and_bailey", name: "Motte-and-bailey", group: "Language",
    definition: "Advancing a bold, controversial claim, then retreating to a modest, defensible one when challenged.",
    guidance: "The text switches between a strong position and a much weaker one that shares its wording, defending the weak version when pressed while continuing to imply the strong one.",
    example: "Astrology controls your destiny; well, when I say that, I only mean the stars are beautiful to think about.",
  },
  {
    id: "loaded_language", name: "Loaded language", group: "Language",
    definition: "Using emotionally charged words or one-sided definitions to settle an argument.",
    guidance: "The text uses a charged label or a slanted definition (persuasive definition) that presupposes its conclusion, so the label itself stands in for the argument it needs. Vivid, forceful or emotional wording alongside real reasons does not count; the loaded term must be doing the work an argument should do.",
    example: "The tax isn't a contribution to public services, it's legalised theft by greedy bureaucrats.",
  },
  {
    id: "quoting_out_of_context", name: "Quoting out of context", group: "Language",
    definition: "Quoting someone selectively so that their words appear to mean something they didn't.",
    guidance: "The text presents a quotation stripped of surrounding words or circumstances in a way that distorts the speaker's evident meaning, and builds its argument on the distortion.",
    example: "The senator said, \"I'm not saying we should cut pensions\" — so, in his own words, \"we should cut pensions.\"",
  },
  {
    id: "moving_the_goalposts", name: "Moving the goalposts", group: "Language",
    definition: "Raising the bar for evidence after the original demand has been met.",
    guidance: "The text dismisses evidence that meets a previously stated standard by demanding new, greater or different proof instead of accepting the result.",
    example: "Fine, you showed me one study; now show me ten, and they'd better be from this year.",
  },
  {
    id: "continuum_fallacy", name: "Continuum fallacy", group: "Language",
    definition: "Rejecting a distinction because there is no sharp line between its extremes.",
    guidance: "The text argues that because a boundary is vague or there is a gradual continuum, the difference between the extremes is meaningless or does not exist (fallacy of the beard).",
    example: "There's no exact number of hairs that makes someone bald, so nobody is really bald.",
  },
  {
    id: "etymological_fallacy", name: "Etymological fallacy", group: "Language",
    definition: "Insisting a word's original or historical meaning is its true meaning.",
    guidance: "The text argues about what something is or should be by appeal to the origin or root of the word naming it, rather than how the word is actually used.",
    example: "\"Decimate\" originally meant killing one in ten, so the storm can't have decimated the town.",
  },
  {
    id: "reification", name: "Reification", group: "Language",
    definition: "Treating an abstraction as if it were a concrete thing with its own will.",
    guidance: "The text treats an abstract concept (nature, society, the market, history) as literally having wants or intentions, and its conclusion depends on that: it says we should defer to the abstraction's supposed will. Ordinary figurative shorthand, such as \"society punishes dissent\" used to describe what people collectively do, does not count.",
    example: "The market wants lower wages, and we shouldn't argue with what the market wants.",
  },

  // Argument structure
  {
    id: "false_equivalence", name: "False equivalence", group: "Argument structure",
    definition: "Treating two things as equivalent because they share some trait, ignoring major differences.",
    guidance: "The text presents two cases, wrongs or positions as morally or factually on a par when they differ greatly in scale, nature or evidence.",
    example: "She forgot to return a library book and he embezzled millions; they're both thieves, really.",
  },
  {
    id: "nirvana_fallacy", name: "Nirvana fallacy", group: "Argument structure",
    definition: "Rejecting a solution because it isn't perfect.",
    guidance: "The text dismisses a realistic option because it does not completely solve the problem, comparing it with an unattainable ideal rather than with the alternatives (perfect solution fallacy).",
    example: "Seatbelts don't save everyone in a crash, so there's no point wearing them.",
  },
  {
    id: "proof_by_assertion", name: "Proof by assertion", group: "Argument structure",
    definition: "Presenting a claim as true simply by stating it confidently, without support.",
    guidance: "The text asserts a contested conclusion as obvious or settled (\"everyone knows\", \"it's a fact\", ipse dixit) and offers no evidence or reasoning for it.",
    example: "It's simply a fact that this policy will fail, and that's all there is to say about it.",
  },
  {
    id: "kettle_logic", name: "Kettle logic", group: "Argument structure",
    definition: "Using several arguments that contradict each other to defend one position.",
    guidance: "The text offers multiple justifications for its conclusion that are mutually inconsistent, so that they cannot all be true.",
    example: "I never borrowed your kettle, it was already broken when I borrowed it, and I gave it back in perfect condition.",
  },
  {
    id: "inflation_of_conflict", name: "Inflation of conflict", group: "Argument structure",
    definition: "Arguing that because experts disagree on details, nothing in a field can be known.",
    guidance: "The text exaggerates disagreement among experts, or treats debate over specifics, as showing the whole field or its core findings are unreliable.",
    example: "Historians still argue about the causes of the war, so we can't really know it happened the way the textbooks say.",
  },
  {
    id: "argument_from_silence", name: "Argument from silence", group: "Argument structure",
    definition: "Drawing a conclusion from the absence of a statement or record where none would be expected.",
    guidance: "The text concludes something is false, or that someone didn't know or believe it, because a source fails to mention it, without showing the source would have mentioned it.",
    example: "Her diary never mentions the treaty, so she must have opposed it.",
  },
  {
    id: "moralistic_fallacy", name: "Moralistic fallacy", group: "Argument structure",
    definition: "Concluding what is true from what ought to be.",
    guidance: "The text rejects a factual claim because it would be morally troubling if true, or asserts a fact because it would be morally desirable.",
    example: "Talent can't be partly inherited, because it would be unfair if it were.",
  },

  // Formal
  {
    id: "affirming_the_consequent", name: "Affirming the consequent", group: "Formal",
    definition: "Reasoning that if A implies B, and B is true, then A must be true.",
    guidance: "The text takes a conditional (if A then B), observes that B holds, and concludes A, ignoring that B could have other causes.",
    example: "If it rained, the street would be wet. The street is wet, so it must have rained.",
  },
  {
    id: "denying_the_antecedent", name: "Denying the antecedent", group: "Formal",
    definition: "Reasoning that if A implies B, and A is false, then B must be false.",
    guidance: "The text takes a conditional (if A then B), observes that A does not hold, and concludes B does not hold either.",
    example: "If you're a doctor, you studied biology. You're not a doctor, so you never studied biology.",
  },
];

export const GROUPS = ["Relevance", "Generalisation", "Cause and statistics", "Language", "Argument structure", "Formal"];

export const BY_ID = Object.fromEntries(FALLACIES.map(f => [f.id, f]));
