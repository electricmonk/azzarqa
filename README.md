

## The problem:
I’d like to have a suite of fast, integrative tests for my full-stack Typescript (or Javascript) application. I’m using React Testing Library and I’m testing the whole app (or whole microfrontend or whatever), but I’d also like to cover my integration with my backend. My options are:

1) Run a single server shared by all tests. This means that all tests share the same data, so they aren’t isolated from each other.
2) Run a separate server for each tests. This requires me to select a random port, incurs some overhead to open the port, close it at the end of the test, and the TCP stuff, and has the potential to introduce flakiness.
3) Use Nock (github.com/nock/nock) for mocking the server. The problem with this solution is that there’s no good way to assert that the mock faithfully represents how the server behaves. 
4) Wrap the code accessing the server in an adapter, then fake this adapter; run UI tests against the fake adapter, then test the fake adapter in a contract test against the real adapter talking to a real server. This has been my preferred solution so far, but it means that any non-trivial logic performed by the backend needs to be reimplemented in one way or another in the fake backend adapter, and it incurs the cost of maintaining the fake adapter and the contract tests.

## Solution:
Instead of faking the backend, run a fresh instance of the real backend in each UI test. Whenever a test causes your client to issue an HTTP request, it gets intercepted 
and handed directly to Express for handling, along with a sepcial response object that can be read by XMLHttpRequst.

All IO preformed by the backend (collaborators: DB, other microservices, etc) should still be wrapped in an adapter and faked, but the scope of faking will be much smaller. 
If working in a microservice environment, each microservice can export its own, tested fake in a testkit to be used by other microservices, so in principle you can test 
the majority of logic in each test, only faking out the databases and external systems. 

## Applicability:
Anything Javascript client that runs in Node.js, including React or any other web framework, React Native, etc. 
The code is agnostic to how the UI performs HTTP requests, it overrides Node’s http.request and https.request. 
Backend-wise, I currently aim at Express applications but other server frameworks can probably be adapted as well. 
To use this library, your Express application should externalize all IO operations to adapters that are provided 
to the application from outside (via dependency injection, whether if by argument-passing or any DI framework). 
Essentially this makes your entire Express application into a pure function, that can be invoked in response
to the overriden HTTP request and produce a referencially transparent response.

## Known issues:
* The code currently lives as a PoC inside my playground / reference TS/React project. If and when I get enough validation that this should be a stand-alone library, I will move the HTTP bridge to its own NPM package / repo.
* I have 9 test cases with one failing, but I know why the bug happens, and at this point I’m stopping for validation before investing more time into this.
* The solution relies on Nock internals for hijacking http.request (and https.request) so it’s completely UI-layer independent. If I move forward I’ll reimplement or copy the code so as not to rely on Nock.
