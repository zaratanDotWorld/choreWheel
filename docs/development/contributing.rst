.. _contributing:

Contributing
============

Introduction
^^^^^^^^^^^^

Chore Wheel is an open-source project, and we warmly welcome contributions — whether in the form of code, discussion, or design ideas.

This guide explains how to approach changes to the design, especially how to think about them conceptually.
It's meant to clarify some of the hidden reasoning behind our choices, and help ensure that new features support the underlying goals of the project.

.. note::

  Before diving in, take a minute to read through our :ref:`design principles <design-principles>`.
  Two of the most relevant for contributors are:

  **Trust through consistency**: everything behaves predictably, month to month, with no sudden changes.
  This builds long-termtrust and keeps the focus where it matters -- on relationships and community.

  **Simplicity where it matters**: not every idea needs to go into the system.
  Simple rules that support rich behavior are better than many special cases.

  These principles aren't dogma — they're what's helped Chore Wheel work well in practice.
  If you're thinking about proposing a change, we'd love to hear how it fits (or challenges!) the ideas above.

At a high level, every tool of Chore Wheel is designed around a foundational **resource**.
For example, `Chores` is built around the idea of **points**, and `Hearts` is built around the idea of **hearts**.
Every tool provides various ways to collaboratively manage this resource.

Chores
^^^^^^

The two foundational concepts for `Chores` are **points** earned by doing chores, and the **priorities** of different chores.
All other behaviors revolves around these two core concepts.

Points

  With `Chores`, the foundational resource is **points**, an ephemeral unit of account which disappears at the end of each month.
  The system is built around creating and distributing points in exchange for contributions to the community.

  Points exist in a "steady state" -- meaning that the amount of points created is always equal to the number of points people owe.
  This idea is critical to the system working -- since the "value" of a point never changes,
  and the expectation of **100 points per month** doesn't change from month-to-month.
  This consistency is important for allowing people to build trust in the system.

  .. warning::

    People sometimes ask for "bonus points" — extra rewards for special behaviors.

    While that sounds appealing, it breaks a core promise of the system:
    that the **total points available always equals the total points owed**.

    **Consider:** what happens if everyone earns their 100 points by the 15th of the month?
    Do we increase the monthly quota to 200?
    Then the value of a point shifts.
    Do we give fewer points for chores afterward?
    Then people not getting bonuses are penalized.

    In short: bonus points **distort the value of the system**.
    When point value feels unstable, people lose trust — and start trying to “game” things instead of working together.

  A stable point system makes it easy to track whether you're contributing fairly over time.
  If the goalposts are always moving, people lose the ability to self-regulate — or worse, they feel like the system is unfair and stop trusting it.

  It's tempting to want to reward "extra effort" with bonus points — and in some systems, that makes sense.
  But Chore Wheel is designed around equality of obligation, not competition or simple gamification.
  Points are meant to be a shared accounting, not a leaderboard.

  .. tip::

    A feature which *did* work was the ability to create **special chores** by voting.
    Creating a special chore *does reduce* the number of points available for the rest of the month, but does so *democratically*.
    Also, a special chore reflects *additional work* needing to be done, so the value of points stays consistent.

    **Consider:** Why do *special chores* work when *bonus points* don't?
    Because they preserve the steady-state — they're democratically approved, represent real extra work, and reduce the remaining points available for others.
    Ultimately, special chores don't add points to the system -- they *reallocate* them in a way the group agrees is fair.

Priorities

  Another foundational `Chores` concept is **priority** -- the *rate* at which a chore gains points over time.
  Priorities are always *relative* -- the priorities of all the chores always adds to 100%.

  Having priorities be relative is useful, since it means that the *total number of points* can increase or decrease as the community changes.
  If two people join the community, then 200 points *in total* are added every month,
  to match the additional 200 points that are now owed (and ultimately, the extra mess that those two people create!).
  Since priorities are relative, you can just multiply the priority (which didn't change) by the new (higher) number of points.
  This allows the system to scale smoothly as the community grows, without changing the underlying design.

  Currently, priorities are decided using a **pairwise system** where participants frame priorities as "this vs. that," rather than enter numbers directly.

  .. image:: https://s3.us-east-1.amazonaws.com/zaratan.world/public/images/misc/chores-flow.png
    :width: 400
    :alt: Chores pairwise flow
    :align: center

  While the pairwise format isn't *fundamental* in the same way that priorities adding to 100% is, it's useful for a few reasons:

  1. It makes it easy to add and remove chores. If priorities were set explicitly as numbers, they would need to be manually "re-balanced" to 100% whenever a chore was added or removed.
  2. It frames choices more intuitively. Instead of thinking about what the "right number" is, the question becomes "do I want more of this or that"?

  .. warning::

    Imagine that priorities were set explicitly, and then a chore with a priority of 5% was deleted.

    **Consider:** what happens with that "extra" 5% priority?

    Does it automatically get split between all the other chores?
    Does the system freeze up until folks go in and manually re-allocate that priority elsewhere?
    Are those extra points just "lost"?

    These questions aren't unsolvable, but they do need to be considered carefully.

Overall, the pairwise format helps keep things simple, scalable, and intuitive — even if it's not strictly required.

Hearts
^^^^^^

Coming soon!

Things
^^^^^^

Coming soon!

Questions or Ideas?
^^^^^^^^^^^^^^^^^^^

If you're curious about a feature idea, want to understand the design better, or just want to chat, please reach out!
We'd love to hear from you — even if your ideas feel half-formed.

You can open a `Github issue <https://github.com/zaratanDotWorld/choreWheel/issues>`_ or email us at hello@zaratan.world.

Open source is better when people talk through ideas together.
