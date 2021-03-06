backbone-conjoin
================

Backbone conjoin allows you to create nested relationships between several collections. Conjoin works via a simple interface where you declare the relationships that one model of a collection can have to one or many models of a different collection. Backbone Conjoin will fetch all collections and map corresponding models into one generalized collection.

Basically, conjoin will do the same thing as a SQL JOIN statement, but on the client side. This may be useful if you are rendering a custom view from a framework and either the overhead of setting domain classes is not viable or you're looking to unload the database layer from taxing operations.

Backbone Conjoin however is not a great solution for large datasets (over 10k records) with a large amount of joined records (joins across 6 or more tables with around 3 nested dependencies.)

Backbone Conjoin was written in an attempt to create an ideal CRUD based MVC where the server framework would only provide domain classes for specified tables. While this application achieved this, the amount of processor load placed on the client side were too taxing. This library can fill this hole somewhat as browsers mitigate more processing power to javascript. 

Installation
------------

Place backbone-conjoin.js in your relevant assets directory (where backbone would be.) if using pre-compiled assets, follow your framework's specific instructions for including this library:

### Rails 

If you have the requirejs gem installed, add this to your config/requirejs.yml:

```ruby
   conjoin: #depends on backbone - should inherit underscore and jquery
     deps: ["Backbone", "jquery"]
     exports: "conjoin"
```
in your application you will need to require the library to have access to it:
```javascript
define ([. . ., conjoin, . . ] , function (myApp) {
  //your app
};
```

Now you can extend super-meta conjoined collections.

Usage
-----

Conjoin can fetch models in three different ways:

1. Fetch all data at once asynchronously
2. Fetch a parent collection, and then fetch siblings based on foreign key relationships
3. Fetch data in batches or chunks

Methods 2 and three require server support to accept parameterized lists of values (we will touch on this later.)

### Method One:

You will need to write a collection which extends backbone conjoin. At the top level, the collection must have the following definitions:

1. A urlRoot property. This should point to the parent collection to base your joins.
2. A BacboneModel definition. While not entirely necessary, it is good practice to have a parent model defined (even if it's emtpy). This will save you some headaches when persisting data.
3. An array named "joins". This will be the configuration container which tells conjoin what to get, how to get it and what to do with it.

So here is a sample setup:

```javascript
MyWidgetsCollection = Backbone.ConjoinedCollection.extend({
      urlRoot: '/operations/inventory',
      model: myWidgetModel, //defined elsewhere
      joins: [
        {
          property: 'widget',
          urlProps: {
            urlRoot: '/operations/widgets',
          },
          idOn: 'widget_id',
          idFrom: 'id',
        },
        {
          property: 'category',
          urlProps: {
            urlRoot: '/operations/widget_categories'
          },
          idOn: 'widget.category_id',
          idFrom: 'id',
        },
        {
          property: 'regionalAvailability',
          urlProps: {
            urlRoot: '/operations/regions_available',
          },
          idOn: 'id',
          idFrom: 'inventory_id'
        },
        {
          property: 'widgetRegions',
          urlProps: {
            urlRoot: '/operations/widget_regions'
          },
          idOn: 'regionalAvailability.region_id',
          idFrom: 'id'
        },
        {
          property: 'vendor',
          urlProps: {
            urlRoot: '/operations/vendors',
          },
          idOn: 'vendor_id',
          idFrom: 'id'
        }
      ]
    });
```

Each object entry in the joins array represents a set of data we wish to fetch. The way we've defined this class, we are fetching data from the following tables / domain classes:

* inventory - Contains foreign keys to prodcuts and vendors. This will be our parent table.
* widgets - Contains foreign keys to widgets_categories
* widget_categories - no foreign keys
* regions_avalaible - join table of foreign keys to the inventory table and the widget regions table 
* widget_regions - no foreign keys. A list of regions we sell widgets
* vendors - no foreign keys. List of vendors.

So, the inventory table would look something like:

#### inventory

| id  | widget_id | vendor_id | widgets_available | widgets_sold |
|-----|-----------|-----------|-------------------|--------------|
| 1   |  201      | 301       |  25               | 17           |
| 2   |  202      | 301       |  77               | 50           |

And our Widgets table is along the lines of:

#### widgets

| id  | widget_name  | category_id |
|-----|--------------|-------------|
| 201 | hair pullers | 401         |
| 202 | eye smoothers| 402         |

#### categories

| id  | category_name |
|-----|---------------|
| 401 | frustration equipment |
| 402 | relaxational devices |

Basically, we want to display an inventory, but just calling that table and presenting a list of id's isn't going to work. We want to display which widgets we have and what kind of widgets (categories) they are.

Now, we've gone and normalized the data, creating a table structure that allows us to track where we sell specific widgets in our inventory. We do that by tracking which item in our inventory is available to which region:

#### regions

| id | region_name |
|----|-------------|
| 1  | Northwest   |
| 2  | West Coast  |
| 3  | Cayman Islands |

And we track which widgets are available in which regions by the following join table:

#### regions_avialable

| id | region_id | inventory_id |
|----|-----------|--------------|
| 1  |  1        | 1            |
| 2  |  2        | 1            |
| 3  |  3        | 1            |
| 4  |  1        | 2            |

So from this, we have hair pullers available in all of our regions and eye smoothers are only available in the Northwest.

#### Configuration

For each joins object entry we need to define the following object structure:

```javascript
{
  property: '',     // a name we will assign the collection
  urlProps: {       // A complex object. See below for property definitions
    urlRoot: ''     // The url we will be fetching the collection 
  },
  idOn: '',         // an id from a different table we want to associate this collection by (foreign key)
  idFrom: ''        // The field in the collection model we will be associating the parent collection
}
```

So The relationship for the "idOn" and "idFrom" positional identifiers are from the perspective of the parent they are joining to. idOn will be a field or foreign key in another table which points to a specific member in the collection we're defining. idFrom is the corresponding member property of the collection we're defining.

So if we're defining a joins member object for widgets, the inventory table maps a widget id by the 'widget_id' field "on" to the widgets table. The widget_id field of the inventory table is mapped "from" the widget id field.

#### Nested Relationships

For more complex joins, you can define an external relationship by specifying the defined property of another join collection using dot notation to reference the associated field of the external collection in your idOn definition. In the above example, we wish to capture a widget category, but it is only referenced by the widgets' join object. We can create a nested relationship of a category onto a widget (which maps onto a inventory item) by referencing the widget collection in our idOn property:

```javascript
idOn: 'widget.category_id',
idFrom: 'id'
```
Conjoin will know then that the category id is a foreign key field held by widgets, and attach categories by widget.

For more deeply nested associations, you may only specify the upper level collection. You can't write something like:

```
// !! Wrong !!
idOn: widget.category.group_id
idFrom: epic_fail_id
```

If you wanted to establish a relationship like this, you would merely define the category association with widget, and if you have a deeper relationship, say categories to groups, you would define something like:

```
// ## Do this instead
{
  property: 'category',
   . . .
  idOn: 'widget.category_id',
  idFrom: 'id',
},
{
  property: 'group',
   . . .
  idOn: 'category.group_id',
  idFrom: 'id',
},
```

For many to many relationships, as in our availability regions, you will need to supply an intermediate join configuration in much the same way a normailized table would work. In our example, consider the following:

```javascript
{
  property: 'regionalAvailability',
    . . .
  idOn: 'id',
  idFrom: 'inventory_id'
},
{
  property: 'widgetRegions',
    . . .
  idOn: 'regionalAvailability.region_id',
  idFrom: 'id'
},
```
The regionalAvailability collection maps the inventory_id field from its table onto the id field of the inventory table. We create a relationship of widgetRegions which map to the regionalAvailability object. So we have the following relationship(s)

Regions:           RegionalAvailability             Inventory

region_id   ->     region_id, inventory_id     ->   id

#### Configuration order

Since you are defining relationships in your configurations, there is no 'order of operations' by which you need to define your join objects. Conjoin can determine relationships and queue things appropriately. Do what makes sense to you and what would be easiest to read.

### Method Two

The above method will fetch whatever the controller brings back. Let's assume, using the above example, that our controllers fetch all of the widgets, categories, vendors, etc. That can be a lot of data. 

What if our inventory table contains a small subset of widgets. We would be fetching a lot of unnecessary data. With some tweaks on the server side, we can limit what we are fetching and associating.

Using our widgets inventory example, let's fetch only the widgets which are referenced in the inventory table:

```javascript
joins: [
{
 property: 'widget',
 urlProps: {
   urlRoot: '/operations/widgets',
   urlExtension: 'set',
   dynamic: 'true',
   delimiter: ';'
 },
 idOn: 'widget_id',
 idFrom: 'id',
 syncWithParent: 'true'
 },
 {
 property: 'category',
 urlProps: {
   urlRoot: '/operations/widget_categories'
 },
 idOn: 'widget.category_id',
 idFrom: 'id',
},
 idOn: 'widget_id',
 idFrom: 'id',
 syncWithParent: 'true'
},
{
 property: 'vendor',
 urlProps: {
   urlRoot: '/operations/vendors',
   urlExtension: 'set',
   dynamic: 'true',
   delimiter: ';'
 },
 idOn: 'vendor_id',
 idFrom: 'id'
 syncWithParent: 'true'
},
{
 property: 'regionalAvailability',
 urlProps: {
   urlRoot: '/operations/regions_available',
   urlExtension: 'set',
   dynamic: 'true',
   delimiter: ';'
 },
 idOn: 'id',
 idFrom: 'product_offering_id'
},
{
 property: 'widgetRegions',
 urlProps: {
   urlRoot: '/operations/widget_regions'
 },
 idOn: 'regionalAvailability.region_id',
 idFrom: 'id'
},
```
We've defined our relationships the same as before but with the additions of a few additional configuration items:

* syncWithParent (true|false) - This tells conjoin that we wish for this fetch to wait until we've fetched the parent (inventory) data.
* urlProps.urlExtension (value) - This is a string that will be appended to the url that the server will be able to route accordingly. 
* urlProps.dynamic (true|false) - The is an indicator to conjoin that it will be building a dynamci based url of mapped id's to the request.
* delimiter (character) - This will be a seperator that the server will be expecting to dilineate values to fetch.

<b>Note</b> You only really need to provide one 'syncWithParent' configuration no matter how many objects need to wait for the parent to sync. Conjoin will <i>always</i> fetch the parent collection first before any others if this is set in any join configuration.

So let's say our inventory table only contains two entries wich have a one-to-one relationship with corresponding entries in the widgets table. And let's say that our widgets table contains 1k entries, two of which we have in stock. It doesn't make sense to fetch and iterate over that many objects if we're only interested in two.

We need to allow our controller to automatically fetch these objects:

#### Rails

##### config/routes.rb
```ruby
get 'widgets/set((/:id);), to: 'widgets#group_fetch'
```

The above will accept urls created conjoin with the delimeter specfied by the application. This for example, will route a request like:

```
http://myRailsApp.com/operations/widgets/set/1;2;3
```

To the group_fetch method defined in the widgets controller. Your params object will look something like:
```
{"controller"=>"widgets", "action"=>"group_fetch", "id"=>"1;2;3", "format"=>"json"}
```

Notice that the id field is just a delimited string. We can parse that in group_fetch to get specific id's in the controller:

##### controllers/widgets_controller.rb
```ruby
def group_fetch
 ids = params[:id].split ';'
 @widgets = Widget.find(ids)
 respond_to do |format|
   render :json => @widgets.to_json()
 end
end
```

### Method Three

Fetching records in batches doesn't require any alternate configuration of Backbone conjoin. we basically want to utilize a batch fetch where we either manually track which batch of id's are required or we fetch in chunks of batches.

Rails Active Record supports the following method to fetch in batches:

```ruby
#records 0 - 25
widgets.find_each(start: 0, batch_size: 25)
#records 26-50
widgets..find_each(start: 26, batch_size: 50)
```

Using method two to constrain related child objects to the parent, we merely want to route and consume requests specifying the batch size and start value.

Add the following properties and method to your ConjoinedCollection extension:

```javascript
batchChunk: -1,
batchSize: 25,
. . .
setBatchUrl: function(batchSize, batchChunk) {
  var batchParams = "/" + batchSize + "/" + batchChunk;
  this.url = this.urlRoot + batchParams;
  this.batchSize = batchSize;
  this.batchChunk = batchChunk;
}
```


Implementation
--------------

Impementation is not much different than accessing a regular collection. That's essentially what we've built, a Backbone collection with several other collections branching from it.

To instantiate our inventory conjoined collection, we simply call:

```javascript
inventoryCollection = new MyWidgetsCollection();
```

To populate our inventoryCollection object, we will call the method fetchConjoined().

fetchConjoined() takes two arguments:

1. whenDoneCallback - a method or 'exit' point to call when fetchConjoined is finished.
2. thisArgs - (optional) pointer or an object supplying optional arguments which will be exposed to the whenDoneCallback method.

A typical invocation may look like the following:

```javascript
inventoryCollection = new MyWidgetsCollection();
inventoryCollection.fetchConjoined( function() {
  inventoryView = new InventoryView( { collection: inventortyCollection });
  inventoryView.render();
}, this);
```

### One vs. Many
Backbone conjoin is intentionally agnostic about what it expects to be returned for a join collection. Conjoin basically goes through each model of the main collection and attaches related data to it. 

For one-to-one relationships (i.e. one widget per inventory entry) we attach a model from the join collection to the model of the current inventory row. We would have the following:

```
conjoinedCollection => inventory
  =>
  . . .
  models[0].attributes[0] => Backbone.Model => widget
  models[0].attributes[1] => Backbone.Model => category
  . . .
```
And so on.

If the request pulls back <i>many</i> object tied to one model, it will attach an array of models:
```
conjoinedCollection => inventoryCollection
  => 
  . . .
  models[0].attributes[0] => Backbone.Model => widget => attribute.name => "Hair Pullers"
  models[0].attributes[1] => Backbone.Model[0] => widgetRegions => attributes.name => "Northwest"
                      [1] => Backbone.Model[1] => widgetRegions => attributes.name => "West Coast"
    
```
For the next inventory item, we only have one available region, so only a model will be returned. As you iterate through each element of a collection, you will need to be aware of this and capture this behavior:

```javascript
_.each(inventoryCollection.models, function (model) {
  if _.isArray(model.attributes.widgetRegions) {
    console.log("I have many regions for this inventory item!");
  } else {
    console.log("Looks like only one widget region defined for this item.");
  }
});
```

### Methods

##### fetchConjoined(whenDoneCallback, thisArgs)
The primary method of this class.
Based on the configuration data, it fetches and conjoins all of the required
elements.

the whenDoneCallback param is used to re-direct control flow after the fetch.
the thisArgs is an optional parameter, will be supplied as the arguments array to
the whenDoneCallback.
Example: (From your application) 
```javascript
myConjoinedCollection.fetchConjoined(function ()
{ 
  myModule.View.render({collection: myConjoinedCollection});
}, this);
```
calling this method from your application will <i>only</i> set your parent collection.
call fetchConjoinedCollections to initialize all of your join objects.
@param {function} whenDoneCallback
@param {Object} thisArgs
@returns {undefined}

##### fetchJoinsOnly(whenDoneCallback, thisArgs)
Fetches <i>only</i> the collections specified by the join collection.
It does not fetch the model.

Useful if you need the raw data to populate a model

@param {function} whenDoneCallback

@param {Object} thisArgs

@returns {undefined}

(in our above examples, this will fetch everything defined in the "joins" array. NOTE this will not work if syncWithParent is true.)

##### getJoinCollection(options)
Returns a collection of objects specifed by the join array. Options argument
can be any specific configuration items (object in the join array) that will
map to that collection. The collection as it was fetched from the server will
be returned.

@param {Object} options

@returns {@exp;requestObject@pro;collection}

So this method will return a fetched collection from the conjoined collection. Let's say we wanted to do something with the widgets collection, we would use this method. 

!!! Major Gotcha !!! So . . . BackboneConjoin, renames the "property" property of a join array object to "identifier" instead of leaving it as is. So, this being the ideal option to pass, you need to specify an object keyed by "identifier" and not "property" for example:

Won't Work:
```javascript
widgetsCollection = inventoryCollection.getJoinCollection({ property: "widgets" });
```

Works:
```javascript
widgetsCollection = inventoryCollection.getJoinCollection({ identifier: "widgets" });
```

Sorry 'bout that.

##### getUnjoinedModel(model) 
This method removes all conjoined relationships from a model
for purposes of synchronization or persistance where the original object needs
to be in the same form it was originally.

 The model is passed in as a separate argument and therefore does not need to be
in the collection defined by this class (i.e. it can be generated from the client side
with the same or similar conjoined properties.)
    
Additional properties may be passed in as a string array in the properties argument.
     
Also, this method does not alter the original model passed in but returns a copy 
of the unconjoined model

@param {Backbone.Model} model
@param {Array} properties
@returns {Backbone.Model}

##### benchmark(start, msg)
Benchmark is a debugging method that can assist you in determining discrete
time intervals for the lifecycle of a conjoined object.
Usage

```javascript
var start = new Date().getTime();
//do something
myConjoinedCollection = new Backbone.ConjoinedCollection();
myConjoinedCollection.fetchConjoined();
myConjoinedCollection.benchmark(start, "to fetch everything");
 ==> "it took ### ms (# seconds) to fetch everything
```

### How it works

The library itself has a smaller footprint than this article. It is not that complicated. The library defines two classes: ConjoinedCollection and Iterator. ConjoinedCollection is the code documented above. 

When new is called to create an instance of an extended class with the required properties set (joins array, urlRoot, base model), We basically parse the joins array and create a set of empty Backbone collections. We also set some flags based on some of the synchronization properties which allows conjoin to know when to get things.

If syncrhonizeWithParent is true, we fetch the parent collection. If not, we fetch all of them. Each fetch is given a promise callback, and when complete, we set a flag on the collection indicating its status. When all collections are complete (all flags are set) we place them in a deferral queue to begin processing. Each collection is fetched asynchronously.

The deferral queue is a lightweight processing queue that can defer processing a collection if it's not ready yet.

So at this stage, we have several collections. We have a master parent which we want to join or embed elements of the other collections. Basically, we iterate through each element of the parent collection (inventory, in the example above.) we then call each collection we have staged and iterate through that. 

If a collection is queued, which is dependent upon another collection which hasn't been joined to the parent yet, we defer that collection to the end of the queue.

Conjoin at this point maps related models of a child collection to the parent, adding the related collection models as attributes of the current parent collection model. 

Once this is all done, we clean up unnecessary resources and call the whenDone callback supplying provided arguments if defined.

### Caveats and lessons learned

I spent more time optimizing this library than I did writing it. And that's saying a lot because I didn't know much about backbone before I began this project. I would love to hear feedback on tips on optimization but, it is what it is. That being said, this is <i>not</i> an ideal solution for pulling large datasets. I attempted to background this process by using setTimeout(), I fetched things in batches when users weren't interacting with the datasets (between keystrokes.) But if you've read the "How it Works" section, you realize that this is a very intensive task O(N^n), which is bad.

Also, most browsers limit the number of simultaneous ajax requests to somewhere around 6. That means if there are more than 6 elements in the joins array, your browser will wait for the first 6 to finish before starting the rest. In this day and age of distributed applications serverd via RESTful web services and single-page apps, limiting ajax requests to 6 is pretty absurd.

So, the ideal solution for joining data like this is SQL. The problem with that is, you wind up polluting your server environment with what I like to call "Hairy queries" which are fun to write and admire, but can quickly ruin it for everybody. Also, complex joins like this are supported by MVC, but not encouraged.

After seeing an untenable client-side performance hit implementing this for a project (script timeout errors) we decided to bite the bullet and model it on the server side. The ORM did not know what to do. It actually took <i>longer</i> for a development server processing one request to return the data than this library did. Inspecting the generated sql showed that some of the joins worked well while others would fire individial selects by id for each record. We bit the bullet again, wrote the hairy query, stuck it on to a model and returned a flattened array of the results. This is a scaling nightmare and kind of the red-headed stepchild of our codebase. I sure wish javascript was truly asynchronous.

So you have to make a choice. 


