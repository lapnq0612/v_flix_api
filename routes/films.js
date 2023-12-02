const express = require("express");
const User = require("../models/User");
const Film = require("../models/Film");
const jwt = require("jsonwebtoken");
const Episode = require("../models/Episode");
const addFullUrl = require("../utils/url");
const Router = express.Router();
const mongoose = require("mongoose");
const authUser = require("../middlewares/authUser");
const authAdmin = require("../middlewares/authAdmin");
const slugify = require('slugify');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const filmPath = path.join('uploads', 'films');
const { promisify } = require('util');


const unlinkAsync = promisify(fs.unlink);

// @route GET amount films
// @desc Get Amount Films
// @access Private
Router.get("/amount", authAdmin, async (req, res) => {
  const amount = await Film.countDocuments();
  res.json(amount);
});

// @route GET film
// @desc Get A Film
// @access Public
Router.get("/", addFullUrl, async (req, res) => {
  try {
    const { slug } = req.query;
    const film = await Film.findOne({ slug: slug })
      .populate('episodes')
      .exec();

    if (!film) {
      return res.status(404).json({ error: 'Film not found' });
    }

    film.poster = `${req.fullUrl}/${film.poster}`;
    film.episodes.sort((a, b) => (a.episode > b.episode) ? 1 : -1);

    res.json(film);
  } catch (err) {
    console.log(err);
  }
});

// @route GET films related
// @desc Get Films Related
// @access Public
Router.get("/related", addFullUrl, async (req, res) => {
  try {
    const { slug } = req.query;
    if (!slug) {
      return res.status(400).json({ message: 'Slug không được để trống' });
    }
    const film = await Film.findOne({ slug, softDelete: false }).populate("episodes");
    if (!film) {
      return res.status(404).json({ message: 'Phim không tìm thấy' });
    }
    const related = await Film.find({
      genre: { $in: [...film.genre] },
      softDelete: false,
    }).populate("episodes").limit(8);
    film.poster = `${req.fullUrl}/${film.poster}`;

    for (let film of related) {
      film.poster = `${req.fullUrl}/${film.poster}`;
    }

    res.json({
      film,
      related,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// @route GET films filter
// @desc Get Films Filter
// @access Public
Router.get("/filter", addFullUrl, async (req, res) => {
  try {
    const { q, genre, bin } = req.query;

    let progress = {};
    if (q) {
      progress.$text = { $search: q };
    }
    if (genre) {
      const checkGenre = typeof genre === "string" ? [genre] : [...genre];
      progress.genre = { $all: checkGenre };
    }
    if (bin) {
      progress.softDelete = true;
    } else {
      progress.softDelete = false;
    }

    const filter = q
      ? [{ ...progress }, { score: { $meta: "textScore" } }]
      : [{ ...progress }];

    const films = await Film.find(...filter).sort(
      q ? { score: { $meta: "textScore" } } : "-date"
    ).populate("episodes");

    for (let film of films) {
      film.poster = `${req.fullUrl}/${film.poster}`;
    }
    res.json(films);
  } catch (err) {
    console.log(err);
  }
});

// @route POST films recent
// @desc POST Films Recent
// @access Private
Router.get("/recent", authUser, addFullUrl, async (req, res) => {
  try {
    const user = req.user;
    // user.history.sort((a, b) => a.date - b.date);
    const history = user.history;
    console.log("history", history)
    const episodeTimestamps = history.reduce((acc, { episodeId, date }) => {
      acc[episodeId] = date;
      return acc;
    }, {});

    console.log("episodeTimestamps", episodeTimestamps)
    var listEpisodeObjects = await Episode.find({
      _id: { $in: Object.keys(episodeTimestamps) },
    });

    console.log('listEpisodeObjects', listEpisodeObjects)
    for (const key in episodeTimestamps) {
      const matchingId = listEpisodeObjects.find(obj => obj._id.toString() === key);
      if (!matchingId) {
        delete episodeTimestamps[key];
      }
    }
    const data = []
    for (const [key, value] of Object.entries(episodeTimestamps)) {
      data.push({
        date: value,
        episodeId: key
      })
    }
    user.history = data
    await user.save();
    const listEpisodes = [];
    const listFilmIds = [];
    listEpisodeObjects.map(item => {
      if (episodeTimestamps.hasOwnProperty(item.id)) {
        let episode = {
          "_id": item._id,
          "title": item.title,
          "description": item.description,
          "episode": item.episode,
          "video": item.video,
          "slug": item.slug,
          "date": episodeTimestamps[item.id],
          "film": item.film._id,
        }
        listFilmIds.push(item.film._id);
        listEpisodes.push(episode);
      }
    });
    const uniqueFilmIds = [...new Set(listFilmIds.map(item => item.toString()))];

    var listFilmObjects = await Film.find({
      _id: { $in: uniqueFilmIds },
    });

    const filmEpisodes = {};
    const ListFilmEpisodes = [];

    for (let episode of listEpisodes) {
      const film = episode.film;
      if (!filmEpisodes[film]) {
        filmEpisodes[film] = [];
        ListFilmEpisodes.push({ [film]: filmEpisodes[film] });
      }
      filmEpisodes[film].push(episode);
      filmEpisodes[film].sort((a, b) => b.date - a.date);
    }

    const listFilms = [];
    listFilmObjects.map(film => {
      if (filmEpisodes.hasOwnProperty(film.id)) {
        let filmObj = {
          "_id": film._id,
          "title": film.title,
          "titleSearch": film.titleSearch,
          "poster": `${req.fullUrl}/${film.poster}`,
          "description": film.description,
          "actor": film.actor,
          "genre": film.genre,
          "reviews": film.reviews,
          "slug": film.slug,
          "date": film.date,
          "episodes": filmEpisodes[film.id]
        }
        listFilms.push(filmObj);
      }
    });
    const options = {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Ho_Chi_Minh' // Set the timezone to Vietnamese time
    };
    const sortedListFilms = listFilms.sort((a, b) => {
      const latestDateA = Math.max(...a.episodes.map(ep => ep.date));
      const latestDateB = Math.max(...b.episodes.map(ep => ep.date));
      return latestDateB - latestDateA;
    });
    const modifiedList = sortedListFilms.map(obj => {
      const modifiedEpisodes = obj.episodes.map(ep => {
        const currentDate = new Date(ep.date);
        const vietnameseDateTime = currentDate.toLocaleString('vi-VN', options);
        const [time, date] = vietnameseDateTime.split(' ');
        const [hour, minute, second] = time.split(':');
        const [day, month, year] = date.split('/');

        const formattedDateTime = `${day}-${month}-${year} ${hour}:${minute}:${second}`;
        // delete ep.film;
        return { ...ep, date: formattedDateTime };
      });
      return { ...obj, episodes: modifiedEpisodes };
    });
    res.json(modifiedList);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// @route POST film
// @desc Create A New Film
// @access Public
Router.post("/", addFullUrl, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const film = {
      'title': req.body.title,
      'poster': req.body.poster,
      'description': req.body.description,
      'genre': req.body.genre,
      'actor': req.body.actor,
      'episodes': req.body.episodes,
    }

    const missingParams = [

    ];

    const requiredFilmKeys = [
      'title',
      'description',
      'poster',
      'genre',
      'actor',
      'episodes'
    ];

    const requiredEpisodeKeys = [
      'title',
      'description',
      'episode',
      // 'poster',
      'video',
    ];

    for (let key of requiredFilmKeys) {
      if (!req.body.hasOwnProperty(key)) {
        missingParams.push(key);
      }
    }

    film.episodes.forEach((episode, index) => {
      for (let key of requiredEpisodeKeys) {
        if (!episode.hasOwnProperty(key)) {
          let episodeKey = Object.keys(film).slice(-1)[0];
          let error = `${episodeKey}[${index}]['${key}']`;
          missingParams.push(error);
        }
      }
    });

    if (missingParams.length > 0) {
      return res.status(400).json({
        error: `Thiếu trường: ${missingParams.join(', ')}`,
      });
    }

    // Check title film exists
    const title = req.body.title;
    const existingFilm = await Film.findOne({ title: title });
    if (existingFilm) {
      return res.status(400).json({ error: `Phim với tiêu '${title}' đã tồn tại` });
    }

    const posterExt = film.poster.substring(
      "data:image/".length,
      film.poster.indexOf(";base64")
    );
    const posterFilename = `${uuidv4()}.${posterExt}`;
    const posterPath = path.join(filmPath, posterFilename);
    const posterFilm = film.poster.split(";base64,").pop();

    // Create the uploads directory if it doesn't exist
    if (!fs.existsSync(filmPath)) {
      fs.mkdirSync(filmPath, { recursive: true });
    }

    await fs.promises.writeFile(posterPath, posterFilm, {
      encoding: "base64",
    });
    console.log("Image Poster Film saved successfully");

    const newFilm = await Film.create({
      title: film.title,
      titleSearch: film.title,
      poster: posterPath,
      description: film.description,
      actor: film.actor,
      genre: film.genre,
    });

    const Episodes = film.episodes.map((episode, index) => {
      const slug = `${film.title} ${episode.title} ${episode.episode}`;
      return {
        ...episode,
        video: episode.video,
        slug: slugify(slug, { lower: true, strict: true }),
        film: newFilm._id,
      };
    })
    const newEpisodes = await Episode.insertMany(Episodes);

    newFilm.episodes = newEpisodes.map((ep) => ep._id);
    await newFilm.save();
    await newFilm.populate('episodes').execPopulate();

    newFilm.poster = `${req.fullUrl}/${newFilm.poster}`;
    await session.commitTransaction();
    res.json(newFilm);
  } catch (err) {
    console.error(err);
    await session.abortTransaction();
    res.status(500).json({ error: "Server error" });
  } finally {
    session.endSession();
  }
});

// @route PATCH film
// @desc UPDATE A Film
// @access Public
Router.patch("/:id", addFullUrl, async (req, res) => {
  try {
    const updates = Object.keys(req.body);
    const allowedUpdates = [
      "title",
      "description",
      "poster",
      "genre",
      "actor",
      "reviews",
      "softDelete",
    ];
    const invalidUpdates = updates.filter((update) =>
      !allowedUpdates.includes(update)
    );

    if (invalidUpdates.length > 0) {
      return res.status(400).json({ error: "Lỗi cập nhật", invalidFields: invalidUpdates, allowUpdateFields: allowedUpdates });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.error(`Invalid film ID: ${req.params.id}`);
      return res.status(400).json({ error: `Lỗi film ID: ${req.params.id}` });
    }

    const film = await Film.findById(req.params.id);

    if (!film) {
      return res.status(404).json({ error: 'Phim không tìm thấy' });
    }

    // Handle poster image upload
    if (req.body.poster) {
      // Remove the old poster image file
      if (film.poster) {
        if (fs.existsSync(path.join(film.poster))) {
          await unlinkAsync(path.join(film.poster));
        }
      }

      // Generate a new filename for the uploaded image
      const posterExt = req.body.poster.substring(
        "data:image/".length,
        req.body.poster.indexOf(";base64")
      );
      const posterFilename = `${uuidv4()}.${posterExt}`;
      const posterPath = path.join(filmPath, posterFilename);
      const posterFilm = req.body.poster.split(";base64,").pop();

      // Save the resized image to disk
      const posterData = Buffer.from(posterFilm, 'base64');
      fs.writeFile(posterPath, posterData, (err) => {
        if (err) throw err;
        console.log('Image Poster Film saved successfully');
      });

      // Update the film object with the new poster image path
      req.body.poster = `${filmPath}/${posterFilename}`;
    }
    if (req.body.title) {
      req.body.titleSearch = req.body.title;
    }
    // Update the film object with the request body
    Object.assign(film, req.body);

    // Save the updated film object to the database
    await film.save();

    // Populate the episodes field and return the updated film object in the response
    film.poster = `${req.fullUrl}/${film.poster}`;
    await film.populate('episodes').execPopulate();
    res.json(film);

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
});

// @route DELETE film
// @desc Remove A Film
// @access Public
Router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.error(`Invalid film ID: ${req.params.id}`);
      return res.status(400).json({ error: `Lỗi phim ID: ${req.params.id}` });
    }

    const film = await Film.findById(req.params.id).populate("episodes");

    if (!film) {
      return res.status(404).json({ error: 'Phim không tìm thấy' });
    }

    if (film.poster) {
      // Remove the old poster image file
      if (fs.existsSync(path.join(film.poster))) {
        await unlinkAsync(path.join(film.poster));
      }
    }

    // Remove related episodes
    await Episode.deleteMany({ film: film._id });

    // Remove film
    await film.remove();
    return res.json({ message: 'Xoá phim thành công' });
  } catch (err) {
    res.status(400).json({ success: false, err });
  }
});

Router.delete("/soft/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.error(`Invalid film ID: ${req.params.id}`);
      return res.status(400).json({ error: `Lỗi phim ID: ${req.params.id}` });
    }

    const film = await Film.findByIdAndUpdate(req.params.id, { softDelete: true }, {
      new: true,
      runValidators: true,
    }).populate("episodes");
    if (!film) {
      return res.status(404).json({ error: 'Phim không tìm thấy' });
    }

    return res.json({ message: 'Xoá mềm phim thành công' });
  } catch (err) {
    res.status(400).json({ success: false, err });
  }
});


// @route GET slug
// @desc Check Slug Exiting
// @access Public
Router.get("/checkSlug/:slug", async (req, res) => {
  try {
    const slugExisting = await Film.findOne({ slug: req.params.slug });
    if (slugExisting) {
      res.json({ msg: "Slug này đã tồn tại" });
    } else {
      res.json({ msg: "" });
    }
  } catch (err) {
    console.log(err);
  }
});

module.exports = Router;
