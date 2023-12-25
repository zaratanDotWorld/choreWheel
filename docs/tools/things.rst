.. _things:

Things
======

`Install Things ↗ <https://things.mirror.zaratan.world/slack/install>`_

There's a saying that "organizations are communities with resources".
One of the economic benefits of living in community is the opportunity to buy supplies more cheaply, in bulk.
Rather than ten tiny bottles of olive oil crowded on the shelf, there can be one large (and cost-effective) bottle (and more shelf space).
Examples abound.

Things is a spending tool, letting residents in a house spend out of a shared account, using their own judgment (within limits) on what should be purchased.

.. note::

  Things is a simple tool for managing shared funds directly in Slack.
  For communities with more advanced needs, consider a more full-featured tool like `Open Collective <https://opencollective.com/>`_.
  These tools can also be combined, allowing simple decisions when possible and more advanced decisions when necessary.

Quickstart
----------

1. Set an app events channel
2. Decide on a monthly budget, and use ``/things-load`` to add it to the account
3. Make a list of 3-5 things that the group buys on a regular basis
4. Enter the things using ``Edit Things List``, and upvote them in the app  channel
5. Encourage people to ``Buy a Thing`` whenever they notice something running low

Core Concepts
-------------

Things
  A thing is anything that the house intends to buy on an ongoing basis.
  Things have names and types (beverage, pantry, etc), as well as a price, quantity, and a link to buy.

Buys
  A buy is a **specific** purchase of a thing.
  Anyone can propose a buy when they notice that something is running low.

Fulfillment
  Fulfillment is the process by which someone actually goes out and physically acquires the thing.
  There are many ways communities can handle actual fulfillment, from online delivery to pickup-truck farmers market runs.
  The system is intentionally flexible here to accomodate diverse scenarios.

Basic Functionality
-------------------

.. image:: https://s3.amazonaws.com/zaratan.world/public/images/mirror/framed-mobile-things-home.jpg
  :width: 400
  :alt: Things app home
  :align: center

The Things home page is the things dashboard.
On the home page, folks can see the current account balance.
The app home is also the entryway into the basic functionality, described below:

:guilabel:`Buy a thing`
  Whenever someone notices that a supply is running low, they can propose that the house buy more.
  The "buy" is then posted publicly, and other residents can upvote or downvote the proposal.
  A minimum of **one upvote per $50** is needed for the buy to succeed, to prevent one person from spending all the community's funds.
  For example, to buy $30 worth of olive oil, only one upvote is needed, that of the proposer.
  To order a $200 house cleaning, on the other hand, a minimum of four upvotes are required.

  Once a buy is resolved, it will be fulfilled in some way, shape, or form.

:guilabel:`Buy special thing`
  From time to time, folks want to buy something which isn't "on the list".
  In that case, they can propose a "special buy" and provide extra details on what they're thinking.
  Special buys have a longer voting window and require more upvotes to pass, reflecting the extra care required.

:guilabel:`Edit things list`
  Before anyone can buy a thing, the thing needs to be defined.
  Things can be added, edited, or deleted.

  Thing edits start as proposals and go to the house for a vote.
  If the vote passes, the thing is created and can be bought.

:guilabel:`See bought things`
  Pull up a view showing pending, approved, and historical buys.
  Historical buys are aggregated by thing, making it easy to see spending trends.

Slash Commands
--------------

In addition to the home page, Things comes with a number of "slash commands" which provide some important management functions.
Most people will not need to know about these commands to use Things.

.. note::

  Commands marked with an asterisk (*) are admin-only

``/things-channel`` \*
  The ``/things-channel`` command is used by workspace administrators to set the events channel for Things, which is where app activity is posted and where housemates go to upvote thing buys and proposals.
  This command takes no arguments, and will set the events channel to the channel in which the command is invoked.

  .. warning::

    A channel **must** be set for the app to work.

``/things-load [amount]`` \*
  The ``/things-load`` command allows admins to add funds to the account.

``/things-fulfill`` \*
  The ``/things-channel`` command brings up a view for admins to mark buys as "fulfilled".

``/things-update`` \*
  Often, prices and links change.
  Rather than going through the process of creating an edit proposal, admins can unilaterally update logistical details for existing things.
  The ``/things-update`` command brings up a view for admins to update thing details.

``/things-sync``
  The ``/things-sync`` command will update the app with the current active users in the workspace, adding any new users and removing any who have been deactivated.
  Keeping the Things app synchronized with the workspace is important, as the number of active users determines the minimum number of upvotes needed for proposals to pass.

  .. warning::

    Make sure to run ``/things-sync`` whenever someone joins or leaves the workspace.
