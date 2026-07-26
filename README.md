# Frontier

Frontier is a connective visual atlas and framework-card workspace for tracing how gaming communities make competitive skill teachable.

M7004R Re:Form - Assessment 2 - Student ID 25000150867

## Research inquiry and audiences

**Research question:** How might a connective visual atlas make the provenance, adaptation and omissions of competitive-game skill frameworks visible while preserving the simplification that makes them useful?

**Primary audience:** community guide creators, wiki contributors, coaches and analysts who produce or maintain gaming knowledge resources.

**Secondary audience:** players and researchers interested in how competitive skill is represented. The principal route is also written to remain understandable to a viewer without specialist gaming knowledge.

Competitive-game knowledge is distributed across developers, players, coaches, platforms and fan archives. Communities compress situated and dynamic play into diagrams, tables, maps and interfaces so it can be taught, compared and debated. Those representations circulate, change and attract disagreement, while their provenance, transformations and omissions can be difficult to trace. Frontier connects selected artefacts and qualified relationships without claiming to replace the communities that made them.

## What the prototype contains

- A dedicated Games route with four game cases and one cross-game classification, connecting moments of play to the guides and reductions players use.
- Three framework lineages with independently linkable detail routes.
- Four visual-format entries organised through the repeated questions "What does it make visible?" and "What does it simplify?"
- Five community contributions coded as application, dispute, personalisation, extension or simplification.
- A comparison view that keeps documented evidence and interpretation distinct.
- A temporary framework-card workspace with a pre-populated example and JSON export. Workspace changes are not stored between page loads.
- Six product routes: Home, Games, Lineages, Reduction atlas, Compare and Workspace.

All research records live in the five canonical files in `data/`; the JavaScript rendering layer reads those records rather than hardcoding historical claims into page templates. Methods, limitations and AI disclosure remain in this README and the separate contextual text rather than appearing as coursework-style product screens.

## Methods

- **Visual analysis:** each selected artefact is examined for its composition, authority cues, intended use, what it makes visible and what it simplifies.
- **Netnography:** anonymised or paraphrased public community contributions from Assessment 1 are coded and attached to the framework they discuss. The interface does not present them as a representative sample of all players.
- **Archival practice:** each canonical source record separates source metadata from Frontier's claims, records source and capture dates separately, credits the creator or community, and states selection and access limits.


## Evidence model

`data/archive_index.json` is the canonical source metadata table. Lineages, formats and disputes refer to its archive IDs, avoiding duplicated source metadata.

Two vocabularies are deliberately separate:

- `relation_type` describes what kind of connection is being proposed, such as `earlier_documented_use`, `community_precedent`, `conceptual_precedent` or `later_adaptation`.
- `evidence_status` describes the support for a specific claim or relationship: `documented`, `interpretive` or `speculative`.

Evidence status belongs to the individual claim or relationship rather than to a whole lineage. A dated earlier use can therefore be documented while a proposed direct influence remains interpretive or speculative. Source date and capture date are also separate: a capture proves what was preserved on the capture date, not when the original artefact first appeared.

## Assessment 1 continuity

Frontier develops the corpus and findings produced in Assessment 1 into an interactive visual product. Assessment 1 established the core argument that visual compression makes complex skill inspectable and useful while also concealing context, uncertainty and excluded forms of skill. The prototype turns that finding into its interface grammar, provenance links and comparison workspace.


## Credits

- Surnex - Micro / Meso / Macro diagram and video case study.
- Player Type - methodology page and interactive adaptation of the Surnex dataset.
- David Sirlin, *Playing to Win* - documented Yomi vocabulary.
- TeamLiquid community - dated StarCraft Micro / Macro teaching vocabulary.
- Dustloop Wiki - Guilty Gear Strive frame-data example.
- Spawning Tool - StarCraft II build-order example.
- Total CS - Mirage callout-map example.


## AI use

Generative AI use included code draft structure review; source-record consistency checking; static-site implementation assistance; test creation; and interface wording, documentation and design review. Source selection, verification, interpretation, website structure and composition, editing and critical argument were completed by the author.

## Limitations

- The small purposive corpus cannot represent every competitive-game genre, community or visual knowledge practice.
- Captures preserve selected states of online sources; they are not complete version histories and may omit earlier revisions or platform context.
- The TeamLiquid and Sirlin evidence images are visibly labelled derived excerpts, not screenshots of the original page interface.
- Anonymised and paraphrased community contributions preserve the analytical codes used in Assessment 1 but cannot show every interaction around the original posts.
- The workspace is intentionally temporary and exports JSON only; it is a prototype of reuse, not a persistent collaborative platform.


## References

- Bowker, G.C. and Star, S.L. (1999) *Sorting Things Out: Classification and Its Consequences*. MIT Press.
- Caswell, M., Punzalan, R. and Sangwand, T.-K. (2017) 'Critical Archival Studies: An Introduction', *Journal of Critical Library and Information Studies*, 1(2).
- Drucker, J. (2014) *Graphesis: Visual Forms of Knowledge Production*. Harvard University Press.
- Kozinets, R.V. (2020) *Netnography*. 3rd edn. SAGE.
- Rose, G. (2023) *Visual Methodologies*. 5th edn. SAGE.
