Design Principles
=================

Three Institutional Layers
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
  A guiding motivation for Mirror is the reduction of the cost of information.
  As observed in *Governing the Commons*, the cost of information is inextricably linked to the design of the system itself.
  A well-designed system, which makes high-quality information cheaply available, will lead to consistently higher-quality decisions and thus better outcomes.
  Mirror achieves this by placing an “event stream” at the center of every module.
  Every action, ultimately an attempt to claim some house resource, creates an event.
  This can then be interacted with by all residents, most simply in the form of an endorsement or a challenge.

Permissionless by Default
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

Chat-based Interfaces
  A second major design motif for Mirror is an orientation around chat-based interfaces.
  It is currently being developed as a set of Slack applications but is, in principle, portable to Discord, or any extensible chat platform.
  The vision is for residents to interact with Mirror via a series of chat bots, allowing governance interactions to occur seamlessly alongside other house communication.
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
  Last but not least, Mirror chooses to use only *subjective* inputs.
  This means that explicit surveillance is not necessary, and communities using Mirror can sidestep invasive measures practiced elsewhere such as mounting a camera behind the sink to see who leaves dirty dishes.
  Such explicit information-gathering approaches create an uncomfortable environment, turn the home into a public sphere, and introduce a new class of measurement error.
  The constrained physical environment allows for frequent eyeballs to perform the same monitoring function in a more pleasant, less invasive way, while also providing a few degrees of discretion (e.g. “wiggle room”).
