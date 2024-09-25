.. _design-principles:

Design Principles
=================

.. note::

  You can read the original project whitepaper `here <http://kronosapiens.github.io/papers/mirror.pdf>`_.


Chore Wheel is **open-source** and **privacy-preserving**, and contains the latest thinking in **ethical technology**.
It draws influences variously from **cognitive science, computer science, electoral theory, economics, cybernetics, and game design**, with four primary design principles:

- No managers or privileged administrative roles
- Simple and intuitive inputs
- Humans for sensing and judgment, machines for bookkeeping
- Continuously available, asynchronous processes

Taken together, this principles describe a system which is "highly available," both technically and socially.
Participants have more opportunities to engage, in a larger variety of ways, while avoiding information overload.
Additionally, the minimal role played by the computer allows participants to attach more legitimacy to the outputs.

Although these design principles can be desirable in many settings, we see the coliving setting as having the **greatest potential for benefit**.
For example, and by contrast, a government workplace would likely also benefit from simple and intuitive inputs, making it easier for employees to meaningfully participate.
But the work done there, being *linear* (i.e. novel, creative) in nature, makes flat organization significantly riskier and more challenging.
In a housing environment, on the other hand, much of the work is *cyclical* (i.e. continuous, repetitious, not meaningfully different between iterations), allowing for new approaches which de-emphasize novel ideation and emphasize resource balancing and mutual accountability.

Further, unlike the distributed and anonymous settings of online communities, coliving environments, being real physical spaces, provide many more opportunities for the informal, casual interactions necessary for building strong relationships.
As such, we can *assume* the existence of a coherent social sphere, with the software tools merely providing a structure for transparency and accountability.

.. note::

  This project is under active development, and has been supported by the **Open-Source Software** (2x), **Governance Research**, and **Metacrisis** rounds of `Gitcoin Grants <https://grants.gitcoin.co/>`_.

Primary Principles
------------------

No Managers or Privileged Administrative Roles
  When thinking about governance, most people immediately think about putting someone in charge, and electing leaders is arguably the foundational process in democratic government.
  Leadership has many benefits: strong leaders can inspire, organize, and guide groups towards successful outcomes.
  However, leadership also has a cost: selfish leaders can subvert a organization to their own ends, weak leaders can delay and obstruct important processes, and vindictive leaders can use their position to play favorites.
  Power inevitably corrupts, and when leadership is structurally protected via elected (or appointed) positions, it can be difficult to remove someone who is no longer right for the role.

  Chore Wheel avoids this by replacing the "hard power" of specific leaders with the "soft power" of flexible leadership.
  Anyone who is motivated to provide leadership is welcome to do so, to the extent that they can organize and motivate others.
  Leadership can look like pioneering a pantry organization, building a vegetable garden, or painting a mural, and people can step into and out of leadership as their circumstances and desires permit.

  Chore Wheel conceptualizes leadership as "icing on the cake:" leaders can bring tremendous value, but if no-one is called to leadership, the community still functions.

  .. note::

    In practice, allowing a small number of privileged actions makes a few things much easier.
    These actions are available to **any admin** in the workspace.
    If a community would prefer that everyone can take these actions, they should make everyone an admin.

Simple and Intuitive Inputs
  For self-governance to be meaningful, participants must be qualified to engage with the issues and decisions they are presented.
  Historically, this has been interpreted as a need for public education and the cultivation of an informed community.
  As society-wide issues grow increasingly complex, however, it becomes increasingly hard for the average person to keep up, making governance a de-facto domain of the privileged.

  Chore Wheel approaches this from a different direction: rather than equip the population to to handle complex decisions (worthwhile as that may be), decisions are kept fundamentally simple and accessible.
  By framing decisions in the simplest possible terms, and ensuring that every decision "contains its own context," participants can **meaningfully** engage in running their communities, without imposing undue burdens and unrealistic expectations.
  This avoids apathy and disengagement, and helps everyone to feel as though the decisions being made truly reflect the intention of the community.

Humans for Sensing and Judgment, Machines for Bookkeeping
  With the rise of machine learning and artificial intelligence, our lives are increasingly been shaped by the outputs of opaque algorithms, trained on questionable data, developed by unaccountable organizations.
  This has led to a significant loss of public trust in technology and in democratic institutions more broadly.

  Having engaged deeply with these critiques, Chore Wheel makes a basic and explicit distinction between the role of the human and the computer.
  The computer's job is not to make decisions on behalf of a community; rather, its job is to guarantee **process** -- to ensure that votes are run fairly and that chores are tallied correctly.
  All of the *subjective* decisions about good or bad, right or wrong, are made *exclusively* by human beings.

  The result is a technical system which people can trust, instead of one which keeps people constantly on guard.

Continuously Available, Asynchronous Processes
  As Oscar Wilde famously quipped, "the trouble with socialism is that it takes up too many evenings".
  Ultimately, the purpose of self-governance is not to sit in meetings, but rather to preserve the right of self-expression in the world.
  When Robert's Rules of Order (the classic guide to running meetings) was written 200 years ago, people wrote with quills and mail traveled by horse.
  While the in-person meeting as a format for decision-making has some benefits, the benefits are mostly due to gathering folks in the same place, and can be better achieved by organizing a dinner or games night.
  As a vehicle for making decisions, apart from the most critical decisions, it is largely obsolete, and an over-reliance on meetings alienates people and concentrates power.

  Chore Wheel recognizes that the majority of decisions *do not* require meetings and the imposition on people's time that meetings entail.
  Instead, all decisions are made *asynchronously*, and people can engage in decision-making at their convenience throughout the day.
  This significantly reduces the burdens of self-governance, making collective leadership accessible to a wider audience.

  .. note::

    While Chore Wheel does not *require* meetings, communities can certainly *have* meetings as needed, as they can be useful for getting alignment on complex issues.
    In addition, major decisions would *probably* benefit from a meeting, but those choices of when and why are best left to the specific community.

    See the section on the :ref:`monthly circle <monthly-circle>` for a possible meeting format.

Secondary Principles
--------------------

These design principles can be developed further:

Three Institutional Layers
  The overall design of Chore Wheel can be understood in terms of three layers, evoking the three layers described in Elinor Ostrom's seminal *Governing the Commons*.
  The first, or **constitutional layer**, involves the design of the modules themselves.
  In this first layer, the design of the entire system and its implementation are up for discussion.
  There are no constraints, as software can be changed in arbitrary ways.
  The constitutional layer can be understood as governing the system from without by changing rules themselves.

  The second layer, the **political layer**, involves participants collaboratively setting explicit parameters that govern the behavior of the system.
  An example would be choosing the frequency with which a certain chore is to be performed.
  In the political layer, residents have control over the system's behavior, but only within the constraints set by the constitutional layer.
  We can think of this as governing the system from within.

  Third and finally, the **operational layer** involves residents individually interacting with the system given the constraints created by the constitutional and political layers.
  In this third layer, residents complete and verify chores, vote on issues, and procure supplies.

  This three-layer design is meant to balance flexibility with simplicity - keeping daily interactions clear and straightforward, and providing residents with a structured means for shaping and controlling their environment, while still allowing for unstructured, open-ended changes to be made as needed.

Cheap Information
  A guiding motivation for Chore Wheel is the reduction of the cost of information.
  As observed in *Governing the Commons*, the cost of information is inextricably linked to the design of the system itself.
  A well-designed system, which makes high-quality information cheaply available, will lead to consistently higher-quality decisions and thus better outcomes.
  Chore Wheel achieves this by placing an “event stream” at the center of every module.
  Every action, ultimately an attempt to claim some house resource, creates an event.
  This can then be interacted with by all residents, most simply in the form of an endorsement or a challenge.

Permissionless by Default
  A major design motif for Chore Wheel is “permissionless by default.” Whenever possible, synchronous voting should be avoided.
  In practice, this means that most actions take the form of challenge-response.
  In such a system, any resident can propose an action (e.g. such as making a purchase out of a shared account).
  If there is no response to the proposal by other residents, the action will be allowed - and likely occur - after a set period of time.
  This will be recorded as having passed with a vote of 1-0, representing implicit consent.
  However, if other residents do not abstain, they may either oppose or support it with their own votes.
  For major actions, a minimum number or percentage of votes in favor may be required, so as to encourage residents to “do their homework” and establish support prior to initiating the vote.

  This approach allows uncontroversial actions to go forward unimpeded (due to a lack of opposition), while allowing for controversial actions to be decided by vote.
  This “lazy consensus” approach mimics the processes successfully practiced by groups such as the Apache Software Foundation and Wikipedia.
  To both discourage initiating frivolous voting and encourage participation in out-of-band communication, residents who propose failed actions will receive a small penalty.

Chat-based Interfaces
  A second major design motif for Chore Wheel is an orientation around chat-based interfaces.
  It is currently being developed as a set of Slack applications but is, in principle, portable to Discord, or any extensible chat platform.
  The vision is for residents to interact with Chore Wheel via a series of chat bots, allowing governance interactions to occur seamlessly alongside other house communication.
  Each module lives in a dedicated channel and interacts with residents via an events log, which is a series of messages providing information and interactivity.
  To avoid spam in these channels, they will be read-only for residents.
  However, residents may add comments and reactions to help keep them engaged with the channels without disrupting their utility.
  Organizing all interactions as events in a log has positive knock-on effects for auditability and reliability, as any specific state can be reconstructed from the underlying event stream.

Anonymity and Identity
  One critical design consideration is the appropriate role and degree of anonymity.
  What actions must be taken publicly and which can be private? No one should have to respond to anonymous criticism, yet publicly identifying oneself can be intimidating and thus disenfranchising.
  Ultimately, we choose to require identity for *initial* actions (e.g. completing a chore, issuing a challenge, or making a purchase), but allowing all votes to be anonymous.
  In this way, at least one person is always linked to any action but the majority of the inputs can be private.

Subjective Inputs
  Last but not least, Chore Wheel chooses to use only *subjective* inputs.
  This means that explicit surveillance is not necessary, and communities using Chore Wheel can sidestep invasive measures practiced elsewhere such as mounting a camera behind the sink to see who leaves dirty dishes.
  Such explicit information-gathering approaches create an uncomfortable environment, turn the home into a public sphere, and introduce a new class of measurement error.
  The constrained physical environment allows for frequent eyeballs to perform the same monitoring function in a more pleasant, less invasive way, while also providing a few degrees of discretion (e.g. “wiggle room”).
