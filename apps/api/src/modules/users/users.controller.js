const usersService = require('./users.service');

const usersController = {
  async list(req, res, next) {
    try {
      const result = await usersService.listUsers(req.query);
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },
  async create(req, res, next) {
    try {
      const user = await usersService.createUser(req.body, req.user.id);
      res.status(201).json({ success: true, data: user });
    } catch (err) { next(err); }
  },
  async get(req, res, next) {
    try {
      const user = await usersService.getUser(req.params.id);
      res.json({ success: true, data: user });
    } catch (err) { next(err); }
  },
  async update(req, res, next) {
    try {
      const user = await usersService.updateUser(req.params.id, req.body, req.user.id);
      res.json({ success: true, data: user });
    } catch (err) { next(err); }
  },
  async loginHistory(req, res, next) {
    try {
      const result = await usersService.getLoginHistory(req.params.id, req.query);
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },
};

module.exports = usersController;
