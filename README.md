backbone-conjoin
================

Backbone conjoin allows you to create nested relationships between several collections. Conjoin works via a simple interface where you declare the relationships that one model of a collection can have to one or many models of a different collection. Backbone Conjoin will fetch all collections and map corresponding models into one generalized collection.

Basically, conjoin will do the same thing as a SQL JOIN statement, but on the client side. This may be useful if you are rendering a custom view from a framework and either the overhead of setting domain classes is not viable or you're looking to unload the database layer from taxin operations.

Backbone Conjoin however is not a great solution for large datasets (over 10k records) with a large amount of joined records (joins across 6 or more tables with around 3 nested dependencies.)

Backbone Conjoin was written in an attempt to create an ideal CRUD based MVC where the server framework would only provide domain classes for specific tables. While this application achieved this, the amount of processor load placed on the client side were too taxing. This library can fill this whole as browsers mitigate more processing power to javascript. 

Installation
------------

Place backbone-conjoin.js in your relevant assets directory (where backbone would be.) if using pre-compiled assets, follow your framework's specific instructions for including this. In rails, you would add:

```ruby
  conjoin: #depends on backbone - should inherit underscore and jquery
    deps: ["Backbone", "jquery"]
    exports: "BackboneConjoin"
```
in your application you will need to require the library to have access to it:
```javascript
define ([. . ., BackboneConjoin, . . ] . . .);
```

Now you can extend super-meta conjoined collections.

Usage
-----

Patience young padawan. We will reveal all shortly.
