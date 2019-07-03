import { expect } from "chai"

import SAM from '../lib/SAM'
import { step, E, first } from '../lib/sam-utils'

let tick = () => ({});

describe('SAM tests', function() {
    before(function() {
        tick = first(SAM({
            component: {
                actions: [
                    () => ({test: true})
                ]
            }
        }).intents)
    }); 

    describe('loop', function() {
        it('create an intent', function() {
            SAM({
                initialState: {
                    counter: 10,
                    status: 'ready'
                }
            })

            expect(tick).to.exist 
        });

        it('add an acceptor', function() {
            SAM({
                component: {
                    acceptors: [
                        model => ({ test }) => {
                            if (test) {
                            model.status = 'testing'
                            }
                        }
                    ]
                }, 
                render: (state) => expect(state.status).to.equal('testing')
            })

            tick()
        });

        it('should add to the application state', function() {
            SAM({
                initialState: {
                    warnings: []
                },
                render: (state) => expect(state.warnings).to.exist
            })

            tick()
        });

  });
});