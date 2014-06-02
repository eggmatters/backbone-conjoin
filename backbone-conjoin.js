/**
 * backbone-conjoin.js
 * let's do it!
 */

(function(window) {
  "use strict";

  var Backbone;
  if ( typeof window === 'undefined' ) {
    Backbone = require( 'backbone' );
  }
  else {
    Backbone = window.Backbone;
  }

  Backbone.ConjoinedCollection = function() {
    this.joinCollections = Array();
    this.model = null;
    this.whenDoneCallback = new Object();
    this.synchronize = null;
    this.configurations = Array();
    //benchmarkStart: new Date().getTime(),
  };
  Backbone.ConjoinedCollection.prototype = {
    /**
     * initialize() overrides Backbone.Collection initialize.
     * This is the constructor called when a new conjoined collection is instantiated.
     * @todo support models, options (comparitor) arguments for Bacbone's native constructor.
     * @returns {_L6.Backbone.ConjoinedCollection.prototype}
     */
    initialize: function() {
      var joins = this.joins;
      _.each(joins, function(joinObject) {
          if (typeof joinObject.syncWithParent !== 'undefined' && joinObject.syncWithParent === 'true') {
            this.synchronize = true;
          }
          this._setJoinedCollection(joinObject);
      }, this);
      return this;
    },
    /**
     * This method allows the user to "change" their joins array configuration and
     * re-initialize the ConjoinedCollection object.
     * This method resets the internal collection associations but not the model mappings.
     * This method is only intended to allow the user to make alterations to the joins array
     * for a new mapped collection (thus the name 'reset'.)
     * @param {Array} joins
     * @returns {undefined}
     */
    resetJoinCollections: function(joins) {
      this.joins = joins;
      this.joinCollections = Array();
      _.each(joins, function(joinObject) {
          if (typeof joinObject.syncWithParent !== 'undefined' && joinObject.syncWithParent === 'true') {
            this.synchronize = true;
          }
          this._setJoinedCollection(joinObject);
      }, this);

    },
    /**
     * fetchModelsOnly()
     * public method calls fetch() on the parent collection for the ConjoinedCollection.
     * the whenDoneCallback param is used to re-direct control flow after the fetch.
     * the thisArgs is a reference to the caller, providing scope access to application.
     * Example: (From your application) myConjoinedCollection.fetchModelsOnly(function ()
     *                                    { myModule.View.render({collection: myConjoinedCollection}), this);
     * calling this method from your application will <i>only</i> set your parent collection.
     * call fetchConjoinedCollections to initialize all of your join objects.
     *
     * @param {function} whenDoneCallback
     * @param {object} thisArgs
     */
    fetchModelsOnly: function(whenDoneCallback, thisArgs) {
      thisArgs = typeof thisArgs !== 'undefined' ? thisArgs : this;
      this.fetch().done( function () {
        if (typeof whenDoneCallback !== 'undefined') {
          whenDoneCallback(thisArgs);
        }
      });
    },
    /**
     * fetchConjoined()
     * The primary method of this class.
     * Based on the configuration data, it fetches and conjoins all of the required
     * elements.
     *
     * the whenDoneCallback param is used to re-direct control flow after the fetch.
     * the thisArgs is an optional parameter, will be supplied as the arguments array to
     * the whenDoneCallback.
     * Example: (From your application) myConjoinedCollection.fetchConjoined(function ()
     *                                    { myModule.View.render({collection: myConjoinedCollection}), this);
     * calling this method from your application will <i>only</i> set your parent collection.
     * call fetchConjoinedCollections to initialize all of your join objects.
     * @param {function} whenDoneCallback
     * @param {Object} thisArgs
     * @returns {undefined}
     */
    fetchConjoined: function(whenDoneCallback, thisArgs) {
      this.whenDoneCallback = { method: whenDoneCallback, args: thisArgs };
      if (this.synchronize) {
        this.fetchModelsOnly(this._fetchCollections, this);
      } else {
        this._fetchCollections(this);
      }
    },
    /**
     * Fetches <i>only</i> the collections specified by the join collection.
     * It does not fetch the model.
     * Useful if you need the raw data to populate a model
     * @param {function} whenDoneCallback
     * @param {Object} thisArgs
     * @returns {undefined}
     */
    fetchJoinsOnly: function(whenDoneCallback, thisArgs) {
      this.whenDoneCallback = { method: whenDoneCallback, args: thisArgs };
      if (this.models.length === 0) {
        this.models[0] = new this.model();
      }
      this._fetchJoinsOnly(this);
    },
    /**
     * Returns a collection of objects specifed by the join array. Options argument
     * can be any specific configuration items (object in the join array) that will
     * map to that collection. The collection as it was fetched from the server will
     * be returned.
     * @param {Object} options
     * @returns {@exp;requestObject@pro;collection}
     */
    getJoinCollection: function(options) {
      var requestObject =  _.find(this.joinCollections, options);
      return requestObject.collection;
    },
    /**
     * This method removes all conjoined relationships from a model
     * for purposes of synchronization or persistance where the original object needs
     * to be in the same form it was originally.
     *
     * The model is passed in as a separate argument and therefore does not need to be
     * in the collection defined by this class (i.e. it can be generated from the client side
     * with the same or similar conjoined properties.)
     *
     * Additional properties may be passed in as a string array in the properties argument.
     *
     * Also, this method does not alter the original model passed in but returns a copy
     * of the unconjoined model
     *
     * @param {Backbone.Model} model
     * @param {Array} properties
     * @returns {Backbone.Model}
     */
    getUnjoinedModel: function(model) {
      var filter = _.pluck(this.joins, 'property');
      if (arguments.length > 1) {
        for (var x = 1; x < arguments.length; x++) {
          filter = filter.concat(arguments[x]);
        }
      }
      var newModel = model.clone();
      var newAttrs = _.omit(newModel.attributes, filter);
      newModel.attributes = newAttrs;
      return newModel;

    },
    _fetchCollections: function(thisArgs) {
      var instance = typeof thisArgs === 'undefined' ? this : thisArgs;
      var count = 0;
      _.each(instance.joinCollections, function (joinCollection){
        if (joinCollection.dynamicUrl) {
          joinCollection.collection.url = joinCollection.urlRoot + '/' +
                  _.uniq(instance.pluck(joinCollection.idOn)).join(';');
          if (joinCollection.collection.url.length > 255) {
            throw new Error("URL length greater than 255 characters.");
          }
        }
        joinCollection.status = "fetching";
        count++;
        $.when(joinCollection.collection.fetch()
               , (count === 1 && !instance.synchronize)
               ? instance.fetch()
               : null)
          .done( function () {
            joinCollection.status = "fetched";
            var stillInProcess = _.reject(instance.joinCollections, { status: "fetched"});
            if (stillInProcess.length === 0 && instance.models.length > 0) {
              instance._fetchComplete(instance);
          }
        });
      });
    },
    _fetchJoinsOnly: function(thisArgs) {
      var instance = typeof thisArgs === 'undefined' ? this : thisArgs;
      _.each(instance.joinCollections, function (joinCollection){
        joinCollection.status = "fetching";
        $.when(joinCollection.collection.fetch())
          .done( function () {
            joinCollection.status = "fetched";
            var stillInProcess = _.reject(instance.joinCollections, { status: "fetched"});
            if (stillInProcess.length === 0) {
              instance._fetchComplete(instance);
          }
        });
      });
    },
    _fetchComplete: function (instance) {
      var deferralQueue = new Backbone.ConjoinedCollection.Iterator(instance.joinCollections);
      while(deferralQueue.next()) {
        if (instance._isDeferrable(instance, deferralQueue.currentObject)) {
          deferralQueue.deferCurrent();
          continue;
        } else {
          if (deferralQueue.currentObject.idOn && deferralQueue.currentObject.idFrom) {
            instance._setModelProperties(instance, deferralQueue.currentObject);
          } else {
            instance._attachCollection(instance, deferralQueue.currentObject);
          }
        }
      }
      instance._cleanupAfterFetch(instance);
    },
    _setModelProperties: function(instance, joinCollection) {
      var dependencies = joinCollection.idOn.split('.');
      var keyOpts = new Object();
      var attrKey = joinCollection.idFrom;

      keyOpts[attrKey] = null;
      _.map(instance.models,
        function(model) {
          if (dependencies.length === 2) {
            var dependentModel = model.get(dependencies[0]);
            if (typeof dependentModel !== 'undefined') {
              if (_.isArray(dependentModel)) {
                joinModels = Array();
                _.each(dependentModel, function(currentDependent) {
                  keyOpts[attrKey] = currentDependent.get(dependencies[1]);
                  joinModels.push(joinCollection.collection.get(keyOpts));
                });
              } else {
                keyOpts[attrKey] = dependentModel.get(dependencies[1]);
                var joinModels = joinCollection.collection.where(keyOpts);
              }
            }
          } else {
            keyOpts[attrKey] = model.get(joinCollection.idOn );
            var joinModels = joinCollection.collection.where(keyOpts);
          }
          _.each(joinModels, function(joinModel) { delete joinModel.collection; });
          model.set(joinCollection.identifier, (joinModels.length === 1) ? joinModels[0] : joinModels);
        });
      joinCollection.status = 'complete';
      //console.debug("mapped dependent instance models? %o", instance.models[0].attributes);

    },
    _isDeferrable: function(instance, joinCollection) {
      if (!joinCollection.idOn || !joinCollection.idFrom) {
        return false;
      }
      var dependentProperties = joinCollection.idOn.split('.');
      if (dependentProperties.length === 1) {
        return false;
      }
      var dependentCollection = _.findWhere(instance.joinCollections, { identifier : dependentProperties[0] });
      if (typeof dependentCollection !== 'undefined' && dependentCollection.status !== 'complete') {
        return true;
      }
      return false;

    },
    _attachCollection: function(instance, joinCollection) {
      _.map(instance.models, function(model) {
        model.set(joinCollection.identifier, joinCollection.collection);
      });
    },
    _cleanupAfterFetch: function(instance) {
      //set and call the whenDoneCallback passed in from calling application:
      instance.whenDoneCallback.method(instance.whenDoneCallback.args);
    },
    _setJoinedCollection: function(joinObject) {
      var urlRoot =  (typeof joinObject.urlProps.urlExtension !== 'undefined') ?
        joinObject.urlProps.urlRoot + "/" + joinObject.urlProps.urlExtension :
          joinObject.urlProps.urlRoot;
      var dynamic = (typeof joinObject.urlProps.dynamic !== 'undefined') ? true : false;
      var parseMethod = (typeof joinObject.parse !== 'undefined') ?
        joinObject.parse :
          function (obj) { return obj; };
      var collection = new Backbone.Collection({ }, { url: urlRoot });
      _.extend(collection, {parse: parseMethod });

      var conjoinedCollection = {
        status: 'ready',
        dynamicUrl: dynamic,
        urlRoot: urlRoot,
        identifier: joinObject.property,
        idOn: joinObject.idOn,
        idFrom: joinObject.idFrom,

        collection: collection };
      this.joinCollections.push(conjoinedCollection);
    },
    /**
     * benchmark()
     * Benchmark is a debugging method that can assist you in determining discrete
     * time intervals for the lifecycle of a conjoined object.
     * Usage:
     *
     * var start = new Date().getTime();
     * //do something
     * myConjoinedCollection = new Backbone.ConjoinedCollection();
     * myConjoinedCollection.fetchConjoined();
     * myConjoinedCollection.benchmark(start, "to fetch everything");
     * ==> "it took ### ms (# seconds) to fetch everything
     * @param {integer} start
     * @param {string} msg
     *
     */
    benchmark: function(start, msg) {
      var end = new Date().getTime();
      var total = end - start;
      var seconds = Number(total / 1000).toFixed(2);
      console.log("it took " + total + " ms (" + seconds + " seconds) " + msg);
    }
  };
  /**
   * Entry point for Backbone.ConjoinedCollection extension.
   * Creates a Conjoined collection instance, attaches the protoProps to it,
   * extends Backbone.Collection with the hybrid object.
   * @param {Object} protoProps Properties / options array defined by the ADM
   * @returns {_L6.Backbone.ConjoinedCollection}
   */
  Backbone.ConjoinedCollection.extend = function( protoProps) {
    var conjoinedInstance = new Backbone.ConjoinedCollection();
    _.extend(conjoinedInstance, protoProps);
    var coll = Backbone.Collection.extend(conjoinedInstance);
    return coll;
  };

  /**
   * Iterator class, acts as a sortable queue for use with
   * Backbone conjoined. It allows objects in a queue to be
   * deferred to the end of the queue.
   * @param {Array} collection
   *
   */
  Backbone.ConjoinedCollection.Iterator = function(collection) {
    this.currentObject = null;
    this.currentIndex  = -1;
    this.collection    = collection;
  };
  Backbone.ConjoinedCollection.Iterator.prototype = {
    hasNext: function() {
      if (this.currentIndex + 1 < this.collection.length) {
        return true;
      }
      return false;
    },
    next: function() {
      if (this.hasNext()) {
        this.currentIndex++;
        this.currentObject = this.collection[this.currentIndex];
        return true;
      }
      this.reset();
      return false;
    },
    deferCurrent: function() {
      var newQueue = Array();
      for (var i = 0; i < this.collection.length; i++) {
        if (i !== this.currentIndex) {
          newQueue.push(this.collection[i]);
        }
      }
      newQueue.push(this.currentObject);
      this.collection = newQueue;
      this.currentIndex--;
    },
    reset: function() {
      this.currentIndex = -1;
      this.currentObject = null;
    },
    findIndex: function(obj) {
      var key = _.keys(obj)[0];
      var val = obj[key];
      for (var i = 0; i < this.collection.length; i++) {
        var comp = this.collection[i];
        if (comp[key] === val ) {
          return i;
        }
      }
      return -1;
    }
  };

})();
