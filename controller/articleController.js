// Dependencies
var express = require('express');
var router = express.Router();
var path = require('path');
var request = require('request');
var cheerio = require('cheerio');

// Models
var Comment = require('../models/Comment.js');
var Article = require('../models/Article.js');

// Routing
router.get('/', function(req, res) {
    res.redirect('/articles');
});

router.get('/scrape', function(req, res) {
    // Use request to get the body of the Html
    request('https://www.androidauthority.com/news/', function(error, response, html) {
        // Load cheerio and set to $
        var $ = cheerio.load(html);
        var titlesArray = [];
        // Get each article
        $('.article-title').each(function(i, element) {
            var result = {};
            // Set the text and link for the result
            result.title = $(this).children('a').text();
            result.link = $(this).children('a').attr('href');
            // console.log(result);
            // Check if not null for title and link
            if(result.title !== "" && result.link !== ""){
              // Check for dupes
              if(titlesArray.indexOf(result.title) == -1){

                // Push saved title to the array 
                titlesArray.push(result.title);

                // Add article if it is unique
                Article.count({ title: result.title}, function (err, test){
                    // If 0, then unique
                  if(test == 0){

                    // Create new article
                    var entry = new Article (result);

                    // Save article into DB
                    entry.save(function(err, doc) {
                      if (err) {
                        console.log(err);
                      } else {
                        console.log(doc);
                      }
                    });

                  }
            });
        }
   
          }
        });
        // Redirect once scraping is done
        res.redirect('/');
    });
});

// Get each article to render
router.get('/articles', function(req, res) {
    // recent articles first
    Article.find().sort({_id: -1})
        // render index
        .exec(function(err, doc) {
            if(err){
                console.log(err);
            } else{
                var artcl = {article: doc};
                res.render('index', artcl);
            }
    });
});

// Gets articles from the DB in JSON
router.get('/articlesjson', function(req, res) {
    Article.find({}, function(err, doc) {
        if (err) {
            console.log(err);
        } else {
            res.json(doc);
        }
    });
});

// Clears all articles for testing purposes
router.get('/clear', function(req, res) {
    Article.remove({}, function(err, doc) {
        if (err) {
            console.log(err);
        } else {
            console.log('removed all articles');
        }

    });
    res.redirect('/articlesjson');
});

router.get('/viewarticle/:id', function(req, res){
  var articleId = req.params.id;
  var hbsObj = {
    article: [],
    body: []
  };

    // //find the article at the id
    Article.findOne({ _id: articleId })
      .populate('comment')
      .exec(function(err, doc){
      if(err){
        console.log('Error: ' + err);
      } else {
        hbsObj.article = doc;
        var link = doc.link;
        //grab article from link
        request(link, function(error, response, html) {
          var $ = cheerio.load(html);

          $('.the-content.padded-panel').each(function(i, element){
            hbsObj.body = $(this).children('.clearfix').children('p').text();
            //send article body and comments to article.handlbars through hbObj
            res.render('article', hbsObj);
            //prevents loop through so it doesn't return an empty hbsObj.body
            return false;
          });
        });
      }

    });
});

// Create a new comment
router.post('/comment/:id', function(req, res) {
  var user = req.body.name;
  var content = req.body.comment;
  var articleId = req.params.id;

  //submitted form
  var commentObj = {
    name: user,
    body: content
  };
 
  //using the Comment model, create a new comment
  var newComment = new Comment(commentObj);

  newComment.save(function(err, doc) {
      if (err) {
          console.log(err);
      } else {
          console.log(doc._id)
          console.log(articleId)
          Article.findOneAndUpdate({ "_id": req.params.id }, {$push: {'comment':doc._id}}, {new: true})
            //execute everything
            .exec(function(err, doc) {
                if (err) {
                    console.log(err);
                } else {
                    res.redirect('/viewarticle/' + articleId);
                }
            });
        }
  });
});

module.exports = router;