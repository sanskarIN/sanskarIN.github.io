---
title: "Rust Typestate: Designing APIs That Make Invalid States Unrepresentable"
description: "Learn how Rust typestate uses the type system to model object lifecycles and prevent invalid operations at compile time, with practical PhantomData examples."
date: 2026-10-08T07:51:33+00:00
author: "Sanskar"
author_url: "/about/"
author_login: "sanskarIN"
image: "/assets/images/blog/rust-typestate-designing-apis-that-make-invalid-states/5a16a0d2b06b2352.png"
image_alt: "Rust typestate diagram showing a builder moving through compile-time states, from incomplete configuration to a fully initialized type, demonstrating how Rust prevents invalid operations through the type system."
image_width: 2000
image_height: 1064
tags: ["rust", "typestate", "systems-programming", "type-systems", "api-design"]
source_issue: 16
---
## Rust Typestate: Designing APIs That Make Invalid States Unrepresentable

Most programming languages let you create an object first and worry about whether it is actually ready to use later.

A connection might be disconnected.

A file might be closed.

A transaction might already be committed.

A parser might not have received enough input.

A device might not have been initialized.

In many systems, these conditions are represented by booleans, nullable fields, runtime checks, or conventions documented somewhere that developers may forget.

Rust gives us another approach:

<strong>make the state part of the type itself.</strong>

This idea is commonly called the <strong>typestate pattern</strong>.

Instead of creating one type that can exist in many vaguely valid states, we create different compile-time states and allow only the operations that make sense for each state.

The result is an API where the compiler becomes part of the protocol design.

---

### The Core Idea

Imagine a connection with two states:

<pre tabindex="0"><code>Disconnected → Connected → Disconnected
</code></pre>

A traditional implementation might look like this:

<pre tabindex="0"><code>struct Connection &#123;
    address: String,
    connected: bool,
&#125;

impl Connection &#123;
    fn send(&amp;self, message: &amp;str) &#123;
        if !self.connected &#123;
            panic!("connection is not active");
        &#125;

        println!("Sending: &#123;message&#125;");
    &#125;
&#125;
</code></pre>

The API allows <code>send()</code> to exist even when the connection is disconnected.

The programmer has to remember the rule:

<blockquote>
<p>“Only call <code>send()</code> after connecting.”</p>
</blockquote>

Rust can express that rule directly in the type system.

---

### Turning State Into a Type

We can represent each state with an empty type:

<pre tabindex="0"><code>struct Disconnected;
struct Connected;
</code></pre>

These types do not need to store any runtime information.

They simply represent two different compile-time states.

Now we can make the connection generic:

<pre tabindex="0"><code>use std::marker::PhantomData;

struct Connection&lt;State&gt; &#123;
    address: String,
    _state: PhantomData&lt;State&gt;,
&#125;
</code></pre>

The <code>State</code> parameter tells Rust which state the connection belongs to.

<code>PhantomData&lt;State&gt;</code> is useful here because it lets the type carry that relationship even though the state itself does not need to occupy storage. Rust documents <code>PhantomData</code> as a zero-sized type used to communicate type-system relationships such as ownership, variance, and related compiler analysis.

Conceptually:

<pre tabindex="0"><code>Connection&lt;Disconnected&gt;
Connection&lt;Connected&gt;
</code></pre>

are two different types.

That difference is extremely important.

---

### Restricting Methods by State

Now we can implement methods only for the states where they make sense.

<pre tabindex="0"><code>impl Connection&lt;Disconnected&gt; &#123;
    fn new(address: impl Into&lt;String&gt;) -&gt; Self &#123;
        Self &#123;
            address: address.into(),
            _state: PhantomData,
        &#125;
    &#125;

    fn connect(self) -&gt; Connection&lt;Connected&gt; &#123;
        Connection &#123;
            address: self.address,
            _state: PhantomData,
        &#125;
    &#125;
&#125;
</code></pre>

<code>connect()</code> exists only for:

<pre tabindex="0"><code>Connection&lt;Disconnected&gt;
</code></pre>

It consumes the disconnected connection and produces:

<pre tabindex="0"><code>Connection&lt;Connected&gt;
</code></pre>

Then we can define operations for the connected state:

<pre tabindex="0"><code>impl Connection&lt;Connected&gt; &#123;
    fn send(&amp;self, message: &amp;str) &#123;
        println!("Sending '&#123;message&#125;' to &#123;&#125;", self.address);
    &#125;

    fn disconnect(self) -&gt; Connection&lt;Disconnected&gt; &#123;
        Connection &#123;
            address: self.address,
            _state: PhantomData,
        &#125;
    &#125;
&#125;
</code></pre>

Now <code>send()</code> is available only when the compiler knows that the connection is connected.

---

### Using the API

The normal flow looks natural:

<pre tabindex="0"><code>fn main() &#123;
    let connection = Connection::&lt;Disconnected&gt;::new("server.example");

    let connection = connection.connect();

    connection.send("Hello Rust!");

    let connection = connection.disconnect();
&#125;
</code></pre>

The important part is not that this code works.

The important part is what <strong>cannot</strong> be written successfully.

Consider:

<pre tabindex="0"><code>fn main() &#123;
    let connection = Connection::&lt;Disconnected&gt;::new("server.example");

    connection.send("Hello!");
&#125;
</code></pre>

This fails because the method belongs to:

<pre tabindex="0"><code>impl Connection&lt;Connected&gt;
</code></pre>

not:

<pre tabindex="0"><code>impl Connection&lt;Disconnected&gt;
</code></pre>

The compiler rejects the invalid state transition before the program runs.

---

## The Compiler Becomes a Protocol Checker

This is where typestate becomes particularly interesting.

A normal API often documents a protocol like this:

<pre tabindex="0"><code>create
   ↓
initialize
   ↓
start
   ↓
use
   ↓
stop
</code></pre>

But documentation alone does not enforce the sequence.

Typestate can encode the sequence directly:

<pre tabindex="0"><code>Device&lt;Created&gt;
       │
       ▼
Device&lt;Initialized&gt;
       │
       ▼
Device&lt;Running&gt;
       │
       ▼
Device&lt;Stopped&gt;
</code></pre>

Each state can expose a different set of operations.

For example:

<pre tabindex="0"><code>struct Created;
struct Initialized;
struct Running;
struct Stopped;
</code></pre>

Then:

<pre tabindex="0"><code>impl Device&lt;Created&gt; &#123;
    fn initialize(self) -&gt; Device&lt;Initialized&gt; &#123;
        // ...
    &#125;
&#125;
</code></pre>

and:

<pre tabindex="0"><code>impl Device&lt;Initialized&gt; &#123;
    fn start(self) -&gt; Device&lt;Running&gt; &#123;
        // ...
    &#125;
&#125;
</code></pre>

and:

<pre tabindex="0"><code>impl Device&lt;Running&gt; &#123;
    fn stop(self) -&gt; Device&lt;Stopped&gt; &#123;
        // ...
    &#125;
&#125;
</code></pre>

The resulting API resembles a state machine, but the compiler enforces the legal transitions.

---

## Why <code>self</code> Is Often Consumed

You may notice something important in these methods:

<pre tabindex="0"><code>fn connect(self) -&gt; Connection&lt;Connected&gt;
</code></pre>

rather than:

<pre tabindex="0"><code>fn connect(&amp;mut self)
</code></pre>

Consuming <code>self</code> is powerful because the old state disappears.

Consider:

<pre tabindex="0"><code>let connection = Connection::&lt;Disconnected&gt;::new("server");

let connection = connection.connect();
</code></pre>

The original value of type:

<pre tabindex="0"><code>Connection&lt;Disconnected&gt;
</code></pre>

has been moved.

The new value has type:

<pre tabindex="0"><code>Connection&lt;Connected&gt;
</code></pre>

We have effectively transformed one state into another.

This fits naturally with Rust's ownership model.

Instead of:

<pre tabindex="0"><code>same object
   ↓
boolean changes
</code></pre>

we get:

<pre tabindex="0"><code>old type
   ↓
ownership transfer
   ↓
new type
</code></pre>

The state transition becomes a type transition.

---

## The Interesting Part: Zero Runtime State

One of the most useful properties of this technique is that the state marker does not have to become a runtime field.

For example:

<pre tabindex="0"><code>struct Connected;
struct Disconnected;
</code></pre>

contain no data.

And:

<pre tabindex="0"><code>PhantomData&lt;State&gt;
</code></pre>

is zero-sized.

So the type:

<pre tabindex="0"><code>Connection&lt;Connected&gt;
</code></pre>

can carry compile-time information without requiring a boolean such as:

<pre tabindex="0"><code>connected: bool
</code></pre>

The state exists primarily for the compiler.

That gives us an interesting design principle:

<blockquote>
<p><strong>Some information belongs in the type system, not in runtime memory.</strong></p>
</blockquote>

---

## Typestate vs Runtime Validation

Typestate does not eliminate runtime validation.

That distinction is important.

Suppose connecting to a server can fail because the server is unreachable.

The compiler cannot know whether the network connection will succeed.

So the transition can still return a <code>Result</code>:

<pre tabindex="0"><code>impl Connection&lt;Disconnected&gt; &#123;
    fn connect(self) -&gt; Result&lt;Connection&lt;Connected&gt;, ConnectError&gt; &#123;
        // Perform runtime connection attempt.

        Ok(Connection &#123;
            address: self.address,
            _state: PhantomData,
        &#125;)
    &#125;
&#125;
</code></pre>

Now we have two layers:

<pre tabindex="0"><code>Compile time
    ↓
Is this operation legal for this state?

Runtime
    ↓
Did the operation actually succeed?
</code></pre>

These are different problems.

Rust can handle both.

---

## A More Realistic Example: Transactions

Transactions are a great example.

Imagine these conceptual states:

<pre tabindex="0"><code>Transaction&lt;Active&gt;
Transaction&lt;Committed&gt;
Transaction&lt;RolledBack&gt;
</code></pre>

You might want:

<pre tabindex="0"><code>impl Transaction&lt;Active&gt; &#123;
    fn commit(self) -&gt; Transaction&lt;Committed&gt; &#123;
        // ...
    &#125;

    fn rollback(self) -&gt; Transaction&lt;RolledBack&gt; &#123;
        // ...
    &#125;
&#125;
</code></pre>

Meanwhile:

<pre tabindex="0"><code>impl Transaction&lt;Committed&gt; &#123;
    // No commit() method.
&#125;
</code></pre>

Now code cannot accidentally commit the same transaction twice through the same typed API.

Likewise, a rolled-back transaction does not expose operations intended for an active transaction.

The state machine becomes visible in the API.

---

## Typestate Is More Than <code>PhantomData</code>

It is tempting to think:

<blockquote>
<p>“Typestate means using <code>PhantomData</code>.”</p>
</blockquote>

Not exactly.

<code>PhantomData</code> is one tool for representing compile-time relationships.

The deeper concept is:

<blockquote>
<p><strong>Use types to encode valid states and legal transitions.</strong></p>
</blockquote>

You can often design typestate APIs without <code>PhantomData</code>, especially when state is naturally represented by distinct structs.

For example:

<pre tabindex="0"><code>struct Locked &#123;
    key: String,
&#125;

struct Unlocked &#123;
    key: String,
&#125;
</code></pre>

You could transition between completely different structs:

<pre tabindex="0"><code>impl Locked &#123;
    fn unlock(self, password: &amp;str) -&gt; Option&lt;Unlocked&gt; &#123;
        if password == "correct" &#123;
            Some(Unlocked &#123; key: self.key &#125;)
        &#125; else &#123;
            None
        &#125;
    &#125;
&#125;
</code></pre>

Here the state is represented by the actual Rust type itself.

<code>PhantomData</code> becomes especially useful when several states share the same underlying representation and only the type-level state changes. Rust's documentation also distinguishes phantom type parameters from <code>PhantomData</code>: a phantom type parameter is unused at runtime, while <code>PhantomData</code> provides a compiler-visible connection to a type.

---

## Designing State Machines With Rust Types

A useful way to approach typestate design is to first draw the state machine.

For example:

<pre tabindex="0"><code>                 ┌──────────────┐
                 │ Disconnected │
                 └──────┬───────┘
                        │ connect()
                        ▼
                 ┌──────────────┐
                 │  Connected   │
                 └──────┬───────┘
                        │ disconnect()
                        ▼
                 ┌──────────────┐
                 │ Disconnected │
                 └──────────────┘
</code></pre>

Then ask:

<strong>Which operations are valid in each state?</strong>

For our connection:

<pre tabindex="0"><code>Disconnected
    └── connect()

Connected
    ├── send()
    └── disconnect()
</code></pre>

Finally, encode those rules into <code>impl</code> blocks.

This turns API design into state-machine design.

---

## A Useful Mental Model

Think of each type as a permission token.

<pre tabindex="0"><code>Connection&lt;Disconnected&gt;
</code></pre>

means:

<blockquote>
<p>“This value has the permissions and operations associated with the disconnected state.”</p>
</blockquote>

While:

<pre tabindex="0"><code>Connection&lt;Connected&gt;
</code></pre>

means:

<blockquote>
<p>“This value has the permissions and operations associated with the connected state.”</p>
</blockquote>

Changing the type changes the permissions.

That makes Rust's type system feel less like a collection of syntax rules and more like an API security boundary.

---

## Where This Pattern Shines

Typestate becomes especially valuable when incorrect ordering can produce subtle bugs.

Examples include:

<pre tabindex="0"><code>Database transactions
File lifecycle APIs
Network protocols
Hardware drivers
Resource initialization
Cryptographic protocols
Parsers
Connection pools
Builder APIs
Embedded systems
Concurrency abstractions
</code></pre>

A builder is another familiar example.

Instead of allowing:

<pre tabindex="0"><code>builder.build()
</code></pre>

at every stage, the type system can require mandatory configuration steps before <code>build()</code> becomes available.

Conceptually:

<pre tabindex="0"><code>Builder&lt;MissingName&gt;
        ↓
Builder&lt;HasName&gt;
        ↓
Builder&lt;Complete&gt;
        ↓
Product
</code></pre>

The compiler effectively becomes a checklist.

---

## The Trade-Off

Typestate is powerful, but it is not automatically better.

Too many states can make an API difficult to understand.

For example:

<pre tabindex="0"><code>Connection&lt;
    Authenticated&lt;
        Encrypted&lt;
            Connected&lt;
                Configured
            &gt;
        &gt;
    &gt;
&gt;
</code></pre>

This can become hard to read and maintain.

The goal is not:

<blockquote>
<p>“Put everything into the type system.”</p>
</blockquote>

The goal is:

<blockquote>
<p><strong>Put important invariants into the type system when doing so makes the API clearer and safer.</strong></p>
</blockquote>

A good typestate API should reduce cognitive load, not increase it.

---

## A Practical Rule

A useful rule for Rust API design is:

<pre tabindex="0"><code>If a state is important enough to check repeatedly,
consider making it part of the type.
</code></pre>

For example, compare:

<pre tabindex="0"><code>if !connection.is_connected() &#123;
    return Err(...);
&#125;

connection.send(data)?;
</code></pre>

with an API where <code>send()</code> simply cannot exist on the disconnected type.

The first approach asks every caller to remember the invariant.

The second approach centralizes the invariant in the API design.

---

## The Deeper Rust Lesson

Typestate reveals something interesting about Rust.

Rust is not only about memory safety.

It can also be used to express <strong>protocol safety</strong>.

Ownership can express who controls a value.

Lifetimes can express how long references remain valid.

Traits can express capabilities and behavior.

Enums can express explicit alternatives.

And typestate can express valid stages in an object's lifecycle.

These mechanisms can be combined.

That is where Rust becomes particularly interesting as a systems language:

<pre tabindex="0"><code>Memory model
     +
Ownership
     +
Lifetimes
     +
Traits
     +
Type-level state
     =
Stronger APIs
</code></pre>

The compiler does not merely check whether your syntax is valid.

With thoughtful API design, it can check whether the way you are using a component makes sense.

---

## Final Thought

One of the biggest shifts in Rust programming is learning to stop asking:

<blockquote>
<p>“How do I check that this state is valid?”</p>
</blockquote>

and start asking:

<blockquote>
<p><strong>“Can I design the API so this invalid state cannot be used in the first place?”</strong></p>
</blockquote>

That is the heart of typestate.

A boolean can tell you that something is connected.

A type can make it impossible to call <code>send()</code> unless the connection is represented as connected.

That difference may look small in a code example.

In a large codebase, it can become a powerful design boundary.

<strong>Rust becomes especially interesting when the compiler is not just checking your implementation—it is enforcing the architecture of your API.</strong>
