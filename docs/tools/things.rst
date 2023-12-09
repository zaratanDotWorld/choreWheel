.. _things:

Things
======

There's an old line that "organizations are communities with resources".
One of the economic benefits of living in community is the opportunity to buy supplies more cheaply, in bulk.
Rather than 12 tiny bottles of olive oil, all crowding each other on the shelf, we can have one large (and less expensive) bottle.
Examples abound.

Things is a spending tool, letting residents in a house spend out of a shared account, using their own judgment (within limits) on what should be purchased.

.. note::

  Things is a simple tool for managing shared funds directly in Slack.
  For communities with more advanced needs, consider a more full-featured tool like `Open Collective <https://opencollective.com/>`_.
  These tools can also be combined, allowing simple decisions when possible and more advanced decisions when necessary.

Core Concepts
-------------

Compared to :ref:`Chores` and :ref:`Hearts`, Things is simple.
There is a list of items that the house can buy: things like toilet paper, olive oil, rice, and the like, generally sold in bulk.
There is an amount of money currently available, the "House Account".
And at any time, anyone can propose the house buy something from the list.

Basic Functionality
-------------------

Buy
~~~

Whenever someone notices that a supply is running low, they can propose that the house buy more.
The "buy" is then posted publicly, and other residents can endorse or reject the proposal.
A minimum of **one endorsement per $50** is needed for the buy to succeed, to prevent one person from unilaterally spending a large proportion of the house's funds.
To buy $30 worth of olive oil, only one endorsement is needed, that of the proposer.
To order a $200 house cleaning, on the other hand, a minimum of four endorsements are required.

Once a buy is resolved, it will be "fulfilled" (hand-wavy, to be sure) in some way, shape, or form.

Slash Commands
--------------

In addition to the home page, Things comes with a number of "slash commands" which provide some important management functions.
Most people will not need to know about these commands to use Things.

.. note::

  Commands marked with an asterisk (*) are admin-only

/things-channel:
  The ``/things-channel`` command is used by workspace administrators to set the events channel for Things, which is where app activity is posted and where housemates go to upvote chore claims and proposals.
  This command takes no arguments, and will set the events channel to the channel in which the command is invoked.

.. warning::

  A channel **must** be set for the app to work.

/things-sync:
  The ``/things-sync`` command will update the app with the current active users in the workspace, adding any new users and removing any who have been deactivated.
  Keeping the Things app synchronized with the workspace is important, as the number of active users determines the minimum number of upvotes needed for proposals to pass.

.. warning::

  Make sure to run ``/things-sync`` whenever someone joins or leaves the workspace.
