/* Define Constants */

const POST = 'post';
const TAGS = 'tags';
const POSTS_LINK = 'post_link';
const TAGS_LINK = 'tag_link';

/* Public Exposed Functions */

function CreatePostAPI(postEntry) {
  postEntry = JSON.parse(postEntry);
  postEntry.uuid = generateUUIDv4();
  const postHash = commit(POST, postEntry);

  CreatePostLinks(postEntry, postHash);

  if ('tags' in postEntry) {
    CreateTags(postEntry, postHash);
  }

  return postHash;
}

// TODO: Need to force post status into a defined sub-set or reject entry.

function CreatePost(postEntry) {
  postEntry.author = App.Agent.String;
  postEntry.uuid = generateUUIDv4();
  if (typeof postEntry.pubdate === 'undefined') {
  postEntry.pubdate = new Date();
  }
  postEntry.lastupdate = new Date();

  if (typeof postEntry.tags !== 'undefined') {
    postEntry.tags = JSON.parse(JSON.stringify(postEntry.tags).replace(/"\s+|\s+"/g, '"'));
  }
  const postHash = commit(POST, postEntry);
  CreatePostLinks(postEntry, postHash);
  if ('tags' in postEntry) {
    CreateTags(postEntry, postHash);
  }
  return {hash: postHash, uuid: postEntry.uuid};
}

function GetPublicPosts(query) {
  if (typeof query !== 'undefined') {
    var links = getLinks(anchor('tags', query.tag), TAGS, {Load: true});
  } else {
    var links = getLinks(anchor('posts', 'public'), POST, {Load: true});
  }
  const posts = [];
  links.forEach(element => {
    const postsObject = {};
    postsObject.hash = element.Hash;
    postsObject.title = element.Entry.title;
    postsObject.content = element.Entry.content;
    postsObject.author = element.Entry.author;
    postsObject.status = element.Entry.status;
    postsObject.tags = element.Entry.tags;
    postsObject.pubdate = element.Entry.pubdate;
    postsObject.lastupdate = element.Entry.lastupdate;
    postsObject.uuid = element.Entry.uuid;
    posts.push(postsObject);
  });
  return posts;
}

function GetAgentInfo() {
  return {name: App.Agent.String, key: App.Key.Hash};
}

function GetPostsByStatus(status) {
  const getPostsbyAgent = getLinks(App.Agent.Hash, POST, {Load: true});
  const posts = [];
  getPostsbyAgent.forEach(element => {
    const postsObject = {};
    if (status === 'any' || element.Entry.status === status) {
      postsObject.hash = element.Hash;
      postsObject.title = element.Entry.title;
      postsObject.content = element.Entry.content;
      postsObject.author = element.Entry.author;
      postsObject.status = element.Entry.status;
      postsObject.tags = element.Entry.tags;
      postsObject.pubdate = element.Entry.pubdate;
      postsObject.lastupdate = element.Entry.lastupdate;
      postsObject.uuid = element.Entry.uuid;
      posts.push(postsObject);
    }
  });
  return posts;
}

function DeletePost(post) {
  if (post.hash !== HC.HashNotFound) {
    if (post.prevState === 'publish' || !('prevState' in post) && post.status === 'publish') {
      commit(POSTS_LINK, {
        Links: [
          {
            Base: anchor('posts', 'public'),
            Link: post.hash,
            Tag: POST,
            LinkAction: HC.LinkAction.Del
          }
        ]
      });
    }
    commit(POSTS_LINK, {
      Links: [
        {
          Base: App.Agent.Hash,
          Link: post.hash,
          Tag: POST,
          LinkAction: HC.LinkAction.Del
        }
      ]
    });
    UnlinkPostFromTags(post.hash);
    remove(post.hash, 'Post Deleted by Agent');
    return 'Post Deleted';
  }
  return 'Hash not found!';
}

function EditPost(post) {

  if (post.hash !== HC.HashNotFound) {

    const prevState = get(post.hash);
    const newState = {
      title: post.title,
      content: post.content,
      author: prevState.author,
      tags: post.tags,
      status: post.status,
      pubdate: prevState.pubdate,
      uuid: prevState.uuid,
      lastupdate: new Date()
    };
    post.prevState = prevState.status;
    try {
      const postHash = update(POST, newState, post.hash);
      CreatePostLinks(newState, postHash);
      if ('tags' in newState) {
        CreateTags(newState, postHash);
      }
    } catch (exception) {
      debug(`Error committing links ${exception}`);
      return post.hash;
    }
    DeletePost(post, prevState);
    return {hash: postHash, uuid: newState.uuid};
  }
  return 'The hash you have introduced is not a valid!';
}

/* Helpers Functions / Private - Non Exposed */

function GetPost(hash) {
  const post = get(hash);
  return post;
}

function CreatePostLinks(content, postHash) {
  if (content.status === 'publish') {
    commit(POSTS_LINK, {Links: [{Base: anchor('posts', 'public'), Link: postHash, Tag: POST}]});
  }
  commit(POSTS_LINK, {Links: [{Base: App.Agent.Hash, Link: postHash, Tag: POST}]});
}

function UnlinkPostFromTags(postHash) {
  const post = GetPost(postHash);
  post.tags.forEach(element => {
    commit(TAGS_LINK, {Links: [{Base: anchor('tags', element), Link: postHash, Tag: TAGS, LinkAction: HC.LinkAction.Del}]});
  });
}

function CreateTags(content, postHash) {
  content.tags.forEach(tag => {
    commit(TAGS_LINK, {Links: [{Base: anchor('tags', tag), Link: postHash, Tag: TAGS}]});
  });
}

// UUIDv4 credit: https://gist.github.com/LeverOne/1308368
function generateUUIDv4(a, b) {
for(b=a='';a++<36;b+=a*51&52?(a^15?8^Math.random()*(a^20?16:4):4).toString(16):'-');
return b;
}

// -----------------------------------------------------------------
//  The Genesis Function https://developer.holochain.org/genesis
// -----------------------------------------------------------------

/**
* Called only when your source chain is generated
* @return {boolean} success
*/
function genesis () {
  return true;
}

// -----------------------------------------------------------------
//  Mixins
// -----------------------------------------------------------------

function anchor(anchorType, anchorText) {
  return call('anchors', 'anchor', {
    anchorType: anchorType,
    anchorText: anchorText
  }).replace(/"/g, '');
}

function anchorExists(anchorType, anchorText) {
  return call('anchors', 'exists', {
    anchorType: anchorType,
    anchorText: anchorText
  });
}

// -----------------------------------------------------------------
//  Validation functions for every change to the local chain or DHT
// -----------------------------------------------------------------

/**
* Called to validate any changes to the local chain or DHT
* @param {string} entryName - the type of entry
* @param {*} entry - the entry data to be set
* @param {object} header - header for the entry containing properties EntryLink, Time, and Type
* @param {*} pkg - the extra data provided by the validate[X]Pkg methods
* @param {object} sources - an array of strings containing the keys of any authors of this entry
* @return {boolean} is valid?
*/
function validateCommit (entryName, entry, header, pkg, sources) {
  switch (entryName) {
    case POST:
    case POSTS_LINK:
    case TAGS_LINK:
    // be sure to consider many edge cases for validating
    // do not just flip this to true without considering what that means
    // the action will ONLY be successfull if this returns true, so watch out!
      return true;
    default:
    // invalid entry name
      return false;
  }
}

/**
* Called to validate any changes to the local chain or DHT
* @param {string} entryName - the type of entry
* @param {*} entry - the entry data to be set
* @param {object} header - header for the entry containing properties EntryLink, Time, and Type
* @param {*} pkg - the extra data provided by the validate[X]Pkg methods
* @param {object} sources - an array of strings containing the keys of any authors of this entry
* @return {boolean} is valid?
*/
function validatePut (entryName, entry, header, pkg, sources) {
  switch (entryName) {
    case POST:
    case POSTS_LINK:
    case TAGS_LINK:
    // be sure to consider many edge cases for validating
    // do not just flip this to true without considering what that means
    // the action will ONLY be successfull if this returns true, so watch out!
      return true;
    default:
    // invalid entry name
      return false;
  }
}

/**
* Called to validate any changes to the local chain or DHT
* @param {string} entryName - the type of entry
* @param {*} entry - the entry data to be set
* @param {object} header - header for the entry containing properties EntryLink, Time, and Type
* @param {string} replaces - the hash for the entry being updated
* @param {*} pkg - the extra data provided by the validate[X]Pkg methods
* @param {object} sources - an array of strings containing the keys of any authors of this entry
* @return {boolean} is valid?
*/
function validateMod (entryName, entry, header, replaces, pkg, sources) {
  switch (entryName) {
    case POST:
    case POSTS_LINK:
    case TAGS_LINK:
    // be sure to consider many edge cases for validating
    // do not just flip this to true without considering what that means
    // the action will ONLY be successfull if this returns true, so watch out!
      return true;
    default:
    // invalid entry name
      return false;
  }
}

/**
* Called to validate any changes to the local chain or DHT
* @param {string} entryName - the type of entry
* @param {string} hash - the hash of the entry to remove
* @param {*} pkg - the extra data provided by the validate[X]Pkg methods
* @param {object} sources - an array of strings containing the keys of any authors of this entry
* @return {boolean} is valid?
*/
function validateDel (entryName, hash, pkg, sources) {
  return null;
}

/**
* Called to validate any changes to the local chain or DHT
* @param {string} entryName - the type of entry
* @param {string} baseHash - the hash of the base entry being linked
* @param {?} links - ?
* @param {*} pkg - the extra data provided by the validate[X]Pkg methods
* @param {object} sources - an array of strings containing the keys of any authors of this entry
* @return {boolean} is valid?
*/
function validateLink (entryName, baseHash, links, pkg, sources) {
  switch (entryName) {
    case POST:
    case POSTS_LINK:
    case TAGS_LINK:
    // be sure to consider many edge cases for validating
    // do not just flip this to true without considering what that means
    // the action will ONLY be successfull if this returns true, so watch out!
      return true;
    default:
    // invalid entry name
      return false;
  }
}

/**
* Called to get the data needed to validate
* @param {string} entryName - the name of entry to validate
* @return {*} the data required for validation
*/
function validatePutPkg (entryName) {
  return null;
}

/**
* Called to get the data needed to validate
* @param {string} entryName - the name of entry to validate
* @return {*} the data required for validation
*/
function validateModPkg (entryName) {
  return null;
}

/**
* Called to get the data needed to validate
* @param {string} entryName - the name of entry to validate
* @return {*} the data required for validation
*/
function validateDelPkg (entryName) {
  return null;
}

/**
* Called to get the data needed to validate
* @param {string} entryName - the name of entry to validate
* @return {*} the data required for validation
*/
function validateLinkPkg (entryName) {
  return null;
}
