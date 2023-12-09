.. _hearts:

Hearts
======

Every community begins with the best of intentions.
And every community, invariably, experiences conflict.
Experiencing conflict is not a choice.
How we deal with it, however, is.

We could choose to ignore conflict, letting it build and fester until communal bonds are permanently damaged.
We could choose to escape responsibility, giving away our power and agency to an authority figure who promises to make our problems go away, but never really does.
Or we could choose to face conflict head-on, engaging in the essential relational processes which lead to fulfilling long-term adult relationships.

Hearts is an accountability tool, used to help structure the experience and resolution of conflict.
Hearts is designed with two goals in mind: first, to give members of a community meaningful tools for holding each other accountable; second, to emphasize communication and repair over judgment and punishment.

Core Concepts
-------------

Hearts:
  The core concept of Hearts is, unsurprisingly, **hearts**.
  Everyone starts with five hearts, and gains and loses them as the result of various processes.

Karma:
  If someone goes above-and-beyond, you can give them "karma".
  Through earning karma, people can earn bonus hearts.

Regeneration/Decay:
  Hearts regenerate at a rate of 1/2 per month, if you have less than 5.
  Hearts decay at the same rate, if you have more than 5.

Basic Functionality
-------------------

Challenges
~~~~~~~~~~

The most dramatic way to lose a heart is by having another resident call you out for bad behavior, by issuing a **challenge** (similar to getting a "strike").
This, rightly, is an uncomfortable experience, but a necessary one, as the final step in the :ref:`conflict-resolution` process.
If you couldn't be called out, or you couldn't call someone else out, then there would be no accountability: problematic behavior would continue until things reached a breaking point; not a situation anyone wants to be in.
By issuing and receiving challenges, we create a structure for engaging proactively with conflict.

Anyone can issue a challenge, stating a number of hearts they think you should lose (up to three), and their reasoning.
The issue then goes to a vote.
If you lose, you lose hearts.
If your challenger loses, they lose hearts.
As a way to prevent abuse, a challenger needs a *minimum* of 40% of the house to support them to win, otherwise they lose by default.
If losing the challenge will leave you with one heart (or none), then they need the support of at least 70% of the house.

It is very unlikely someone would challenge you arbitrarily, as they are strongly disincentivize from doing so.
Anyone who issues a challenge stands to lose hearts themselves, if other residents feel they are out of line.
Instead, challenges should come as no surprise, and represent a final step in a respectful process of disagreement.

Regeneration
~~~~~~~~~~~~

It is said that time heals all wounds.
Whether or not that is true is a question for psychologists and philosophers.
What we can say with confidence is that time restores lost hearts.
Specifically, a half-heart per month, for everybody, always.
This is how we center rehabilitation over punishment.
If you lose a heart for whatever reason, integrate the lesson, and soon enough it will be forgotten.
Hearts regeneration will only take you back to the five-heart baseline.
If you already have five hearts, you don't get more.

Karma
~~~~~

Much of Hearts is about handling conflict.
But what about all the good things that happen, which are in all likelihood the majority of the interactions occurring among the residents? For that we have **karma**.
Anyone can give karma to another resident by adding a "plus-plus" (``++``) after their name.
Every month, all the karma is added together, and the resident with the most karma gets a bonus heart, on top of the half-heart that everyone gets.
Even more, you can get a karma heart even if you have a full five hearts, giving you an epic **six** or even **seven** hearts.

Slash Commands
--------------

In addition to the home page, Hearts comes with a number of "slash commands" which provide some important management functions.
Most people will not need to know about these commands to use Hearts.

.. note::

  Commands marked with an asterisk (*) are admin-only

/hearts-channel*
  The ``/hearts-channel`` command is used by workspace administrators to set the events channel for Hearts, which is where app activity is posted and where housemates go to upvote chore claims and proposals.
  This command takes no arguments, and will set the events channel to the channel in which the command is invoked.

.. warning::

  A channel **must** be set for the app to work.

/hearts-sync
  The ``/hearts-sync`` command will update the app with the current active users in the workspace, adding any new users and removing any who have been deactivated.
  The sync command will also add the Hearts app to all public channels, allowing people to give/earn karma in those channels.
  Keeping the Hearts app synchronized with the workspace is important, as the number of active users determines the minimum number of upvotes needed for proposals to pass.

.. warning::

  Make sure to run ``/hearts-sync`` whenever someone joins or leaves the workspace.
