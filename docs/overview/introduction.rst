..  _introduction:

Introduction
============

.. note::

  You can read the original project whitepaper `here <https://bit.ly/mirror-whitepaper>`_.

As housing costs continue to climb, the development of quality, affordable housing remains a continual challenge.
It is increasingly apparent that shared living situations – housing configurations where residents have private bedrooms but share common facilities like kitchens, bathrooms, and living rooms – are an important part of the solution.

Perhaps the greatest benefit afforded by shared living situations is the avoidance of redundant infrastructure (e.g. one large kitchen, rather than three small ones), which drive down costs.
However, the provisioning of common housing resources introduces new coordination challenges (e.g. “who does the dishes”).
Historically, such challenges have been overcome through informal norms (e.g. a “dish-zero” rule), deliberative decision-making processes (e.g. house meetings), or basic coordination mechanisms (e.g. an analog chore wheel).
But such solutions are unreliable, burdensome, and often too simplistic to meet the needs of a large and varied population.
As Oscar Wilde famously quipped, “the trouble with socialism is that it takes up too many evenings.” We can do better.

Mirror is *poetic technology*: a suite of tools meant to support the healthy functioning of a shared living environment.
Drawing influences variously from cognitive science, computer science, electoral theory, economics, cybernetics, and game design, it functions with four top-level design goals:

- No managers or privileged administrative roles
- Simple and intuitive inputs
- Humans for sensing and judgment, machines for bookkeeping
- Continuously available, asynchronous processes

Although many of these principles can benefit social structures outside of shared living, we have intentionally chosen this setting for the specific advantages it provides.
For example, and by contrast, a government workplace would likely also benefit from simple and intuitive inputs.
But the work done there, being *linear* (i.e. novel, creative) in nature, makes leaderless organization deeply challenging.
In a residential environment, much of the work is *cyclical* – continuous, repetitious, and not meaningfully different between iterations – more naturally allowing for specialized solutions which deemphasize novel ideation and emphasize resource balancing and peer accountability.

Further, unlike the highly distributed and anonymous settings of online communities, residential environments, by virtue of being shared physical spaces where participants spend a significant amount of their time, provide arguably the maximal number of opportunities for the informal, out-of-band communication essential for eliciting empathy and identification, and building relationships and friendships.
As such, we should *assume* the existence of a coherent social sphere, with the technical system merely providing measurement hooks into accountability and enforcement logic.
The aim, then, is the creation of an objective external representation that closely *mirrors* the subjective inner state (e.g. organic norms and culture) that we take as a given.

Note that Mirror does not claim to capture all ideation, decision making, and deliberation necessary for a shared living environment.
Nor does its use preclude the need for ongoing investments in education and culture.
Rather, it takes its cue from the Pareto principle: a set of simple, general processes which, given a reasonably trained population, manages the most common 80% of scenarios, leaving the remaining 20% to be handled by locally-determined, informal processes.

Design
------

Three Institutional Layers
~~~~~~~~~~~~~~~~~~~~~~~~~~

The overall design of Mirror can be understood in terms of three layers, evoking the three layers described in Elinor Ostrom’s seminal *Governing the Commons*.
The first, or **constitutional layer**, involves the design of the modules themselves.
In this first layer, the design of the entire system and its implementation are up for discussion.
There are no constraints, as software can be changed in arbitrary ways.
The constitutional layer can be understood as governing the system from without by changing rules themselves.

The second layer, the **political layer**, involves participants collaboratively setting explicit parameters that govern the behavior of the system.
An example would be choosing the frequency with which a certain chore is to be performed.
In the political layer, residents have control over the system’s behavior, but only within the constraints set by the constitutional layer.
We can think of this as governing the system from within.

Third and finally, the **operational layer** involves residents individually interacting with the system given the constraints created by the constitutional and political layers.
In this third layer, residents complete and verify chores, vote on issues, and procure supplies.

This three-layer design is meant to balance flexibility with simplicity – keeping daily interactions clear and straightforward, and providing residents with a structured means for shaping and controlling their environment, while still allowing for unstructured, open-ended changes to be made as needed.

Cheap Information
~~~~~~~~~~~~~~~~~

A guiding motivation for Mirror is the reduction of the cost of information.
As observed in *Governing the Commons*, the cost of information is inextricably linked to the design of the system itself.
A well-designed system, which makes high-quality information cheaply available, will lead to consistently higher-quality decisions and thus better outcomes.
Mirror achieves this by placing an “event stream” at the center of every module.
Every action, ultimately an attempt to claim some house resource, creates an event.
This can then be interacted with by all residents, most simply in the form of an endorsement or a challenge.

Permissionless by Default
~~~~~~~~~~~~~~~~~~~~~~~~~

A major design motif for Mirror is “permissionless by default.” Whenever possible, synchronous voting should be avoided.
In practice, this means that most actions take the form of challenge-response.
In such a system, any resident can propose an action (e.g. such as making a purchase out of a shared account).
If there is no response to the proposal by other residents, the action will be allowed – and likely occur – after a set period of time.
This will be recorded as having passed with a vote of 1-0, representing implicit consent.
However, if other residents do not abstain, they may either oppose or support it with their own votes.
For major actions, a minimum number or percentage of votes in favor may be required, so as to encourage residents to “do their homework” and establish support prior to initiating the vote.

This approach allows uncontroversial actions to go forward unimpeded (due to a lack of opposition), while allowing for controversial actions to be decided by vote.
This “lazy consensus” approach mimics the processes successfully practiced by groups such as the Apache Software Foundation and Wikipedia.
To both discourage initiating frivolous voting and encourage participation in out-of-band communication, residents who propose failed actions will receive a small penalty.

Chat-based Interface
~~~~~~~~~~~~~~~~~~~~

A second major design motif for Mirror is an orientation around chat-based interfaces.
It is currently being developed as a set of Slack applications but is, in principle, portable to Discord, or any extensible chat platform.
The vision is for residents to interact with Mirror via a series of chat bots, allowing governance interactions to occur seamlessly alongside other house communication.
Each module lives in a dedicated channel and interacts with residents via an events log, which is a series of messages providing information and interactivity.
To avoid spam in these channels, they will be read-only for residents.
However, residents may add comments and reactions to help keep them engaged with the channels without disrupting their utility.
Organizing all interactions as events in a log has positive knock-on effects for auditability and reliability, as any specific state can be reconstructed from the underlying event stream.

Anonymity and Identity
~~~~~~~~~~~~~~~~~~~~~~

One critical design consideration is the appropriate role and degree of anonymity.
What actions must be taken publicly and which can be private? No one should have to respond to anonymous criticism, yet publicly identifying oneself can be intimidating and thus disenfranchising.
Ultimately, we choose to require identity for *initial* actions (e.g. completing a chore, issuing a challenge, or making a purchase), but allowing all votes to be anonymous.
In this way, at least one person is always linked to any action but the majority of the inputs can be private.

Subjective Inputs
~~~~~~~~~~~~~~~~~

Last but not least, Mirror chooses to use only *subjective* inputs.
This means that explicit surveillance is not necessary, and communities using Mirror can sidestep invasive measures practiced elsewhere such as mounting a camera behind the sink to see who leaves dirty dishes.
Such explicit information-gathering approaches create an uncomfortable environment, turn the home into a public sphere, and introduce a new class of measurement error.
The constrained physical environment allows for frequent eyeballs to perform the same monitoring function in a more pleasant, less invasive way, while also providing a few degrees of discretion (e.g. “wiggle room”).
